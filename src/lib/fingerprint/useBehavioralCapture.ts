"use client";

// src/lib/fingerprint/useBehavioralCapture.ts
//
// フォーム操作の行動計測フック（ヘッドレス = UI を一切持たない）。
// 返り値の containerProps をフォームのラッパー要素に spread するだけで、
// 配下の入力要素すべての行動統計を capture フェーズで収集する。
//
// プライバシー上の不変条件（このフックが構造的に保証する）:
// - キーの内容は記録しない（Backspace/Delete か否かの判別のみで、e.key は保存しない）
// - 入力値・ペースト内容は記録しない（文字数のみ）
// - マウス座標の生系列は保持せず統計値のみ
//
// 使用例（詳細レシピ: src/features/core/fingerprintChallenge/README.md）:
//   const behavior = useBehavioralCapture();
//   <div {...behavior.containerProps}> ...フォーム... </div>
//   // 送信時: behavior.getPayload()

import { useCallback, useEffect, useMemo, useRef } from "react";

import {
  BEHAVIOR_PAYLOAD_VERSION,
  type BehaviorPayload,
  type FieldBehavior,
  type PointerBehavior,
} from "./types";

/** 記録するフィールド数の上限（payload サイズの暴走防止） */
const MAX_FIELDS = 50;
/** focusOrder の記録上限 */
const MAX_FOCUS_ORDER = 100;
/** ポインタ移動のサンプリング間隔 (ms) */
const POINTER_SAMPLE_INTERVAL_MS = 50;

/** Welford のオンライン分散計算。生系列を保持せず平均 / 標準偏差を求める */
type Welford = { count: number; mean: number; m2: number };

const newWelford = (): Welford => ({ count: 0, mean: 0, m2: 0 });

function pushWelford(w: Welford, value: number): void {
  w.count += 1;
  const delta = value - w.mean;
  w.mean += delta / w.count;
  w.m2 += delta * (value - w.mean);
}

const welfordMean = (w: Welford): number | null =>
  w.count > 0 ? Math.round(w.mean * 100) / 100 : null;

const welfordStd = (w: Welford): number | null =>
  w.count > 1 ? Math.round(Math.sqrt(w.m2 / (w.count - 1)) * 100) / 100 : null;

type FieldState = {
  keyCount: number;
  backspaceCount: number;
  keyIntervals: Welford;
  lastKeyAt: number | null;
  pasteCount: number;
  pasteTotalLength: number;
  focusCount: number;
  dwellMs: number;
  focusedAt: number | null;
};

const newFieldState = (): FieldState => ({
  keyCount: 0,
  backspaceCount: 0,
  keyIntervals: newWelford(),
  lastKeyAt: null,
  pasteCount: 0,
  pasteTotalLength: 0,
  focusCount: 0,
  dwellMs: 0,
  focusedAt: null,
});

type PointerState = {
  sampleCount: number;
  totalDistance: number;
  speeds: Welford;
  byType: Record<string, number>;
  lastX: number | null;
  lastY: number | null;
  lastAt: number | null;
  startX: number | null;
  startY: number | null;
};

const newPointerState = (): PointerState => ({
  sampleCount: 0,
  totalDistance: 0,
  speeds: newWelford(),
  byType: {},
  lastX: null,
  lastY: null,
  lastAt: null,
  startX: null,
  startY: null,
});

type CaptureState = {
  startedAt: number;
  fields: Map<string, FieldState>;
  focusOrder: string[];
  pointer: PointerState;
  visibilityHiddenCount: number;
};

const newCaptureState = (): CaptureState => ({
  startedAt: Date.now(),
  fields: new Map(),
  focusOrder: [],
  pointer: newPointerState(),
  visibilityHiddenCount: 0,
});

/** 入力要素からフィールド識別名を解決する。data-behavior-field > name > id の優先順 */
function resolveFieldName(target: EventTarget | null): string | null {
  if (!(target instanceof HTMLElement)) return null;
  const el = target.closest("input, textarea, select, [contenteditable]");
  if (!(el instanceof HTMLElement)) return null;
  return (
    el.dataset.behaviorField ||
    el.getAttribute("name") ||
    el.id ||
    "__unnamed__"
  );
}

export type BehavioralCapture = {
  /** フォームのラッパー要素（form / div）に spread する capture フェーズハンドラ群 */
  containerProps: {
    onKeyDownCapture: (e: React.KeyboardEvent) => void;
    onPasteCapture: (e: React.ClipboardEvent) => void;
    onFocusCapture: (e: React.FocusEvent) => void;
    onBlurCapture: (e: React.FocusEvent) => void;
    onPointerMoveCapture: (e: React.PointerEvent) => void;
  };
  /** 現時点までの行動統計 payload を生成する（何度呼んでもよい） */
  getPayload: () => BehaviorPayload;
  /** 計測をゼロからやり直す（フォームリセット時など） */
  reset: () => void;
};

export function useBehavioralCapture(): BehavioralCapture {
  const stateRef = useRef<CaptureState>(newCaptureState());

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        stateRef.current.visibilityHiddenCount += 1;
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const getField = useCallback((target: EventTarget | null): FieldState | null => {
    const name = resolveFieldName(target);
    if (!name) return null;
    const { fields } = stateRef.current;
    let field = fields.get(name);
    if (!field) {
      if (fields.size >= MAX_FIELDS) return null;
      field = newFieldState();
      fields.set(name, field);
    }
    return field;
  }, []);

  const containerProps = useMemo(
    () => ({
      onKeyDownCapture: (e: React.KeyboardEvent) => {
        const field = getField(e.target);
        if (!field) return;
        const now = Date.now();
        field.keyCount += 1;
        // キー内容は保存しない。修正操作の判別のみ行う
        if (e.key === "Backspace" || e.key === "Delete") field.backspaceCount += 1;
        if (field.lastKeyAt !== null) {
          const interval = now - field.lastKeyAt;
          // 離席等の極端な間隔は打鍵リズムとして無意味なので除外
          if (interval > 0 && interval < 5000) pushWelford(field.keyIntervals, interval);
        }
        field.lastKeyAt = now;
      },
      onPasteCapture: (e: React.ClipboardEvent) => {
        const field = getField(e.target);
        if (!field) return;
        field.pasteCount += 1;
        try {
          // 内容は読まず長さのみ記録する
          field.pasteTotalLength += e.clipboardData?.getData("text")?.length ?? 0;
        } catch {
          // clipboardData 不可の環境では回数のみ
        }
      },
      onFocusCapture: (e: React.FocusEvent) => {
        const name = resolveFieldName(e.target);
        const field = getField(e.target);
        if (!name || !field) return;
        field.focusCount += 1;
        field.focusedAt = Date.now();
        const { focusOrder } = stateRef.current;
        if (focusOrder.length < MAX_FOCUS_ORDER) focusOrder.push(name);
      },
      onBlurCapture: (e: React.FocusEvent) => {
        const field = getField(e.target);
        if (!field || field.focusedAt === null) return;
        field.dwellMs += Date.now() - field.focusedAt;
        field.focusedAt = null;
      },
      onPointerMoveCapture: (e: React.PointerEvent) => {
        const p = stateRef.current.pointer;
        const now = Date.now();
        if (p.lastAt !== null && now - p.lastAt < POINTER_SAMPLE_INTERVAL_MS) return;
        const x = e.clientX;
        const y = e.clientY;
        if (p.startX === null) {
          p.startX = x;
          p.startY = y;
        }
        if (p.lastX !== null && p.lastY !== null && p.lastAt !== null) {
          const distance = Math.hypot(x - p.lastX, y - p.lastY);
          const elapsed = (now - p.lastAt) / 1000;
          p.totalDistance += distance;
          if (elapsed > 0) pushWelford(p.speeds, distance / elapsed);
        }
        p.sampleCount += 1;
        p.byType[e.pointerType || "unknown"] = (p.byType[e.pointerType || "unknown"] ?? 0) + 1;
        p.lastX = x;
        p.lastY = y;
        p.lastAt = now;
      },
    }),
    [getField],
  );

  const getPayload = useCallback((): BehaviorPayload => {
    const state = stateRef.current;
    const now = Date.now();

    const fields: Record<string, FieldBehavior> = {};
    for (const [name, f] of state.fields) {
      // フォーカス中のまま payload 生成された場合の滞在時間を加算
      const dwellMs = f.dwellMs + (f.focusedAt !== null ? now - f.focusedAt : 0);
      fields[name] = {
        keyCount: f.keyCount,
        backspaceCount: f.backspaceCount,
        meanKeyIntervalMs: welfordMean(f.keyIntervals),
        stdKeyIntervalMs: welfordStd(f.keyIntervals),
        pasteCount: f.pasteCount,
        pasteTotalLength: f.pasteTotalLength,
        focusCount: f.focusCount,
        dwellMs,
      };
    }

    const p = state.pointer;
    const netDisplacement =
      p.startX !== null && p.startY !== null && p.lastX !== null && p.lastY !== null
        ? Math.hypot(p.lastX - p.startX, p.lastY - p.startY)
        : null;
    const pointer: PointerBehavior = {
      sampleCount: p.sampleCount,
      totalDistance: Math.round(p.totalDistance),
      meanSpeed: welfordMean(p.speeds),
      stdSpeed: welfordStd(p.speeds),
      straightness:
        netDisplacement !== null && p.totalDistance > 0
          ? Math.round((netDisplacement / p.totalDistance) * 1000) / 1000
          : null,
      byType: p.byType,
    };

    return {
      version: BEHAVIOR_PAYLOAD_VERSION,
      durationMs: now - state.startedAt,
      fields,
      focusOrder: state.focusOrder,
      pointer,
      visibilityHiddenCount: state.visibilityHiddenCount,
    };
  }, []);

  const reset = useCallback(() => {
    stateRef.current = newCaptureState();
  }, []);

  return { containerProps, getPayload, reset };
}
