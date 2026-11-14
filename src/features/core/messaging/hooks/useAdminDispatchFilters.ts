"use client";

// src/features/core/messaging/hooks/useAdminDispatchFilters.ts
//
// 管理: 回の一覧の絞り込み(AdminDispatchList はこれを呼んで欄を並べるだけ。CLAUDE.md core_ui)。
// - 入力中の値(期間から・まで・種別・カテゴリー・経路・状態)と、「絞り込む」で確定した filters を分けて持つ
// - カテゴリーは種別を選んだ後だけ(種別を変えると空に戻す)。定義の鍵では絞らない(D46: 画面は鍵を打たせない)
// - 期間は日付(YYYY-MM-DD)の入力 → from = その日の 0 時、to = 「まで」の翌日の 0 時(未満)
// - clear = 入力も確定も空に戻す

import { useCallback, useState } from "react";

import type { AdminDispatchFilters } from "../services/client/adminMessagingClient";

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
  const [status, setStatus] = useState<string>(initialFilters.status ?? "");
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
        status: status || undefined,
      }),
    [fromDate, toDate, kind, category, channel, status],
  );

  const clear = useCallback(() => {
    setFromDate("");
    setToDate("");
    setKindState("");
    setCategory("");
    setChannel("");
    setStatus("");
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
    },
  };
}
