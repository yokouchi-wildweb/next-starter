// src/features/core/interactionTracking/services/client/impressionTracker.ts
// インプレッション等の高頻度イベント用バッファ付きトラッカー
//
// 1 イベント = 1 リクエストにせず、モジュールスコープのバッファに集約して
// 定期フラッシュ（15 秒）+ ページ離脱時フラッシュでまとめて送信する。
// 100 表示 = 1 リクエスト。送信先はバッチ ingest（POST /api/interactions/batch）で、
// registry の batchActions に登録された action のみ受理される。

"use client";

import axios from "axios";

const ENDPOINT = "/api/interactions/batch";
const FLUSH_INTERVAL_MS = 15_000;
/** バッチ ingest の 1 リクエスト上限（スキーマの max と揃える） */
const MAX_ENTRIES = 100;

export type TrackImpressionInput = {
  targetType: string;
  targetId: string;
  /** 既定 "impression" */
  action?: string;
  source?: string;
};

type BufferEntry = {
  targetType: string;
  targetId: string;
  action: string;
  source?: string;
  count: number;
};

const buffer = new Map<string, BufferEntry>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let lifecycleAttached = false;

function drainBuffer(): BufferEntry[] {
  const events = Array.from(buffer.values());
  buffer.clear();
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  return events;
}

/** バッファを即時送信する（通常は自動フラッシュに任せてよい） */
export function flushImpressions(): void {
  const events = drainBuffer();
  if (events.length === 0) return;
  // 計測はベストエフォート。失敗（オフライン・レート制限等）は握りつぶす
  void axios.post(ENDPOINT, { events }).catch(() => {});
}

/**
 * ページ離脱時のフラッシュ。unload 中は XHR が中断されるため sendBeacon を使う
 * （クライアント fetch 禁止規約の例外ではなく、Beacon API は fetch と別物）。
 */
function flushWithBeacon(): void {
  const events = drainBuffer();
  if (events.length === 0) return;
  if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") return;
  const payload = new Blob([JSON.stringify({ events })], { type: "application/json" });
  navigator.sendBeacon(ENDPOINT, payload);
}

function ensureLifecycleListeners(): void {
  if (lifecycleAttached || typeof window === "undefined") return;
  lifecycleAttached = true;
  // pagehide はモバイル Safari 含め最も確実な離脱シグナル。
  // visibilitychange(hidden) はタブ切替時にも送ることで取りこぼしをさらに減らす
  window.addEventListener("pagehide", flushWithBeacon);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushWithBeacon();
  });
}

/**
 * インプレッションを 1 件記録する（バッファ集約・fire-and-forget）。
 *
 * 同一 (targetType, targetId, action, source) は count に合算され、
 * 15 秒ごと / ページ離脱時 / バッファ満杯時にまとめて送信される。
 * 表示判定（ビューポート交差）とセットで使う場合は useImpressionTracker を推奨。
 */
export function trackImpression(input: TrackImpressionInput): void {
  if (typeof window === "undefined") return;

  const action = input.action ?? "impression";
  const key = [input.targetType, input.targetId, action, input.source ?? ""].join(" ");
  const entry = buffer.get(key);
  if (entry) {
    entry.count += 1;
  } else {
    buffer.set(key, {
      targetType: input.targetType,
      targetId: input.targetId,
      action,
      source: input.source,
      count: 1,
    });
  }

  ensureLifecycleListeners();

  if (buffer.size >= MAX_ENTRIES) {
    // スキーマ上限に達したら即時送信（エントリの取りこぼし防止）
    flushImpressions();
    return;
  }
  if (flushTimer === null) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flushImpressions();
    }, FLUSH_INTERVAL_MS);
  }
}
