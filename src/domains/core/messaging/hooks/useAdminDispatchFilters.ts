"use client";

// src/domains/core/messaging/hooks/useAdminDispatchFilters.ts
//
// 管理: 送信の一覧の絞り込み(AdminDispatchList はこれを呼んで欄を並べるだけ。CLAUDE.md core_ui)。
// - 入力中の値(期間から・まで・種別・カテゴリー・送信チャンネル・状態・送り元・送った人・件名・運営が送った物だけ)と、「絞り込む」で確定した filters を分けて持つ
// - 送り元・送った人の選択肢は useAdminDispatchFilterOptions(鍵・id は値にだけ、D46)。件名は前後の空白を落とし、空なら送らない。100 字で切る(サーバーの上限)
// - 運営が送った物だけ = sentBy admin(D210)
// - カテゴリーは種別を選んだ後だけ(種別を変えると空に戻す)。定義の鍵では絞らない(D46: 画面は鍵を打たせない)
// - 期間は日付(YYYY-MM-DD)の入力 → from = その日の 0 時、to = 「まで」の翌日の 0 時(未満)
// - 状態の欄の DISPATCH_FILTER_DELETED(削除済み)= 削除した送信だけ(deleted only、状態では絞らない、D88)
// - clear = 入力も確定も空に戻す

import { useCallback, useState } from "react";

import { DISPATCH_FILTER_DELETED } from "../constants/dispatchFilters";
import type { AdminDispatchFilters } from "../services/client/adminMessagingClient";

/** 件名の文字検索の上限(サーバーの q と同じ) */
export const DISPATCH_SUBJECT_QUERY_MAX = 100;

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

export function useAdminDispatchFilters(initialFilters: AdminDispatchFilters = {}) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [kind, setKindState] = useState<string>(initialFilters.kind ?? "");
  const [category, setCategory] = useState<string>(initialFilters.kind ? (initialFilters.category ?? "") : "");
  const [channel, setChannel] = useState<string>(initialFilters.channel ?? "");
  const [status, setStatus] = useState<string>(initialFilters.deleted === "only" ? DISPATCH_FILTER_DELETED : (initialFilters.status ?? ""));
  const [source, setSource] = useState<string>(initialFilters.source ?? "");
  const [actor, setActor] = useState<string>(initialFilters.actor ?? "");
  const [subject, setSubject] = useState<string>(initialFilters.q ?? "");
  const [adminOnly, setAdminOnly] = useState<boolean>(initialFilters.sentBy === "admin");
  const [filters, setFilters] = useState<AdminDispatchFilters>(initialFilters);

  /** 種別を変える(選んでいたカテゴリーは空に戻す: カテゴリーは種別ごと) */
  const setKind = useCallback((next: string) => {
    setKindState(next);
    setCategory("");
  }, []);

  const apply = useCallback(
    () =>
      setFilters({
        from: dispatchFilterStartOf(fromDate),
        to: dispatchFilterNextDay(toDate),
        kind: (kind || undefined) as AdminDispatchFilters["kind"],
        category: (kind && category) || undefined,
        channel: channel || undefined,
        status: (status !== DISPATCH_FILTER_DELETED && status) || undefined,
        source: source || undefined,
        actor: actor || undefined,
        sentBy: adminOnly ? ("admin" as const) : undefined,
        q: dispatchSubjectQueryOf(subject),
        ...(status === DISPATCH_FILTER_DELETED ? { deleted: "only" as const } : {}),
      }),
    [fromDate, toDate, kind, category, channel, status, source, actor, adminOnly, subject],
  );

  const clear = useCallback(() => {
    setFromDate("");
    setToDate("");
    setKindState("");
    setCategory("");
    setChannel("");
    setStatus("");
    setSource("");
    setActor("");
    setSubject("");
    setAdminOnly(false);
    setFilters({});
  }, []);

  return {
    /** 確定した絞り込み(useAdminDispatches に渡す) */
    filters,
    apply,
    clear,
    fields: {
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
      /** 送った人の利用者 id(選択肢は actorOptions) */
      actor,
      setActor,
      /** 件名の文字検索の入力 */
      subject,
      setSubject,
      /** 運営(管理者)が送った物だけ(D210) */
      adminOnly,
      setAdminOnly,
    },
  };
}
