"use client";

// src/domains/core/messaging/hooks/useAdminDispatchFilters.ts
//
// 管理: 送信の一覧の絞り込み(AdminDispatchList はこれを呼んで欄を並べるだけ。CLAUDE.md core_ui)。
// - 選んだらすぐ効く(「絞り込む」の確定は無い)。件名の文字だけは打ち終えて DISPATCH_SUBJECT_DEBOUNCE_MS 待ってから効かせる
// - 送った側の切り替え sentBy(types/dispatchSentBy.ts、D210): 既定 admin = 手動送信 / system = 自動送信。自動送信は送った人で絞らない(送った人の欄は空に戻す)
// - 期間は区切り(period): all / today / 7d / 30d = 今日を含むその日数の 0 時から / custom = 日付(YYYY-MM-DD)の入力の from・to
//   (from = その日の 0 時、to = 「まで」の翌日の 0 時(未満))。区切りの起点は選んだ時に決める(描くたびに動かない)
// - カテゴリーは種別を選んだ後だけ(種別を変えると空に戻す)。定義の鍵では絞らない(D46: 画面は鍵を打たせない)
// - 送り元・送った人の選択肢は useAdminDispatchFilterOptions(鍵・id は値にだけ、D46)。件名は前後の空白を落とし、空なら送らない。100 字で切る(サーバーの上限)
// - 状態の欄の DISPATCH_FILTER_DELETED(削除済み)= 削除した送信だけ(deleted only、状態では絞らない、D88)
// - detailCount = 詳しい絞り込み(種別・カテゴリー・送信方法・状態・送り元・送った人)のうち選んでいる数(ボタンの数の印)
// - clearAll = 送った側以外の全部を空に戻す(送った側はそのまま)

import { useCallback, useEffect, useMemo, useState } from "react";

import { DISPATCH_FILTER_DELETED } from "../constants/dispatchFilters";
import type { AdminDispatchFilters } from "../services/client/adminMessagingClient";
import type { DispatchSentBy } from "../types/dispatchSentBy";

/** 件名の文字検索の上限(サーバーの q と同じ) */
export const DISPATCH_SUBJECT_QUERY_MAX = 100;
/** 件名の入力を一覧に効かせるまで待つ時間(ms) */
export const DISPATCH_SUBJECT_DEBOUNCE_MS = 400;

/** 期間の区切り */
export const DISPATCH_PERIODS = ["all", "today", "7d", "30d", "custom"] as const;
export type DispatchPeriod = (typeof DISPATCH_PERIODS)[number];

/** 区切り → 今日を含む日数(all・custom は null) */
const PERIOD_DAYS: Record<DispatchPeriod, number | null> = { all: null, today: 1, "7d": 7, "30d": 30, custom: null };

/** 件名の入力 → q(前後の空白を落とす。空は undefined、長すぎる分は切る) */
export function dispatchSubjectQueryOf(text: string): string | undefined {
  const trimmed = text.trim();
  return trimmed ? trimmed.slice(0, DISPATCH_SUBJECT_QUERY_MAX) : undefined;
}

/** 日付の入力(YYYY-MM-DD)のその日の始まり(ISO)。空・不正は undefined */
export function dispatchFilterStartOf(date: string): string | undefined {
  if (!date) return undefined;
  const d = new Date(`${date}T00:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** 日付の入力の翌日の始まり = 期間の上限(未満)。空・不正は undefined */
export function dispatchFilterNextDay(date: string): string | undefined {
  if (!date) return undefined;
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return undefined;
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}

/** 区切りの起点(今日を含む days 日の最初の日の 0 時、ISO)。now は検査が渡す */
export function dispatchPeriodStartOf(period: DispatchPeriod, now: Date = new Date()): string | undefined {
  const days = PERIOD_DAYS[period];
  if (days === null) return undefined;
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - (days - 1));
  return d.toISOString();
}

/** initialFilters = 最初の絞り込み(sentBy を省くと手動送信。from・to は使わない: 期間の区切りは all から) */
export function useAdminDispatchFilters(initialFilters: AdminDispatchFilters = {}) {
  const [sentBy, setSentByState] = useState<DispatchSentBy>(initialFilters.sentBy ?? "admin");
  const [period, setPeriodState] = useState<DispatchPeriod>("all");
  const [periodStart, setPeriodStart] = useState<string | undefined>(undefined);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [kind, setKindState] = useState<string>(initialFilters.kind ?? "");
  const [category, setCategory] = useState<string>(initialFilters.kind ? (initialFilters.category ?? "") : "");
  const [channel, setChannel] = useState<string>(initialFilters.channel ?? "");
  const [status, setStatus] = useState<string>(initialFilters.deleted === "only" ? DISPATCH_FILTER_DELETED : (initialFilters.status ?? ""));
  const [source, setSource] = useState<string>(initialFilters.source ?? "");
  const [actor, setActor] = useState<string>(initialFilters.sentBy === "system" ? "" : (initialFilters.actor ?? ""));
  const [subject, setSubject] = useState<string>(initialFilters.q ?? "");
  const [appliedSubject, setAppliedSubject] = useState<string>(initialFilters.q ?? "");

  // 件名は打ち終えてから効かせる(1 字ごとに一覧を取り直さない)
  useEffect(() => {
    if (subject === appliedSubject) return undefined;
    const timer = setTimeout(() => setAppliedSubject(subject), DISPATCH_SUBJECT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [subject, appliedSubject]);

  /** 送った側を変える(自動送信は送った人で絞らない) */
  const setSentBy = useCallback((next: DispatchSentBy) => {
    setSentByState(next);
    if (next === "system") setActor("");
  }, []);

  /** 種別を変える(選んでいたカテゴリーは空に戻す: カテゴリーは種別ごと) */
  const setKind = useCallback((next: string) => {
    setKindState(next);
    setCategory("");
  }, []);

  /** 期間の区切りを変える(起点は選んだ時に決める。custom 以外にしたら日付の入力は空に戻す) */
  const setPeriod = useCallback((next: DispatchPeriod) => {
    setPeriodState(next);
    setPeriodStart(dispatchPeriodStartOf(next));
    if (next !== "custom") {
      setFromDate("");
      setToDate("");
    }
  }, []);

  const filters = useMemo<AdminDispatchFilters>(
    () => ({
      sentBy,
      from: period === "custom" ? dispatchFilterStartOf(fromDate) : periodStart,
      to: period === "custom" ? dispatchFilterNextDay(toDate) : undefined,
      kind: (kind || undefined) as AdminDispatchFilters["kind"],
      category: (kind && category) || undefined,
      channel: channel || undefined,
      status: (status !== DISPATCH_FILTER_DELETED && status) || undefined,
      source: source || undefined,
      actor: (sentBy === "admin" && actor) || undefined,
      q: dispatchSubjectQueryOf(appliedSubject),
      ...(status === DISPATCH_FILTER_DELETED ? { deleted: "only" as const } : {}),
    }),
    [sentBy, period, periodStart, fromDate, toDate, kind, category, channel, status, source, actor, appliedSubject],
  );

  const detailCount = [kind, kind && category, channel, status, source, sentBy === "admin" && actor].filter(Boolean).length;

  const clearAll = useCallback(() => {
    setPeriodState("all");
    setPeriodStart(undefined);
    setFromDate("");
    setToDate("");
    setKindState("");
    setCategory("");
    setChannel("");
    setStatus("");
    setSource("");
    setActor("");
    setSubject("");
    setAppliedSubject("");
  }, []);

  return {
    /** 今の絞り込み(useAdminDispatches に渡す。選ぶとすぐ変わる) */
    filters,
    /** 詳しい絞り込みのうち選んでいる数 */
    detailCount,
    clearAll,
    fields: {
      /** 送った側(admin = 手動送信 / system = 自動送信) */
      sentBy,
      setSentBy,
      /** 期間の区切り(custom の時だけ fromDate・toDate を使う) */
      period,
      setPeriod,
      fromDate,
      setFromDate,
      toDate,
      setToDate,
      kind,
      setKind,
      /** カテゴリー(種別を選んだ後だけ選べる) */
      category,
      setCategory,
      channel,
      setChannel,
      status,
      setStatus,
      /** 送り元の鍵(選択肢は useAdminDispatchFilterOptions の sourceOptions) */
      source,
      setSource,
      /** 送った人の利用者 id(選択肢は actorOptions。手動送信の時だけ) */
      actor,
      setActor,
      /** 件名の文字検索の入力(一覧に効くのは待ってから) */
      subject,
      setSubject,
    },
  };
}
