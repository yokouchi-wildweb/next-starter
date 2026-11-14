"use client";

// src/features/core/messaging/hooks/useAdminDispatchFilters.ts
//
// 管理: 回の一覧の絞り込み(AdminDispatchList はこれを呼んで欄を並べるだけ。CLAUDE.md core_ui)。
// - 入力中の値(期間から・まで・定義の鍵・種別・経路・状態)と、「絞り込む」で確定した filters を分けて持つ
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
  const [messageKey, setMessageKey] = useState(initialFilters.messageKey ?? "");
  const [kind, setKind] = useState<string>(initialFilters.kind ?? "");
  const [channel, setChannel] = useState<string>(initialFilters.channel ?? "");
  const [status, setStatus] = useState<string>(initialFilters.status ?? "");
  const [filters, setFilters] = useState<AdminDispatchFilters>(initialFilters);

  const apply = useCallback(
    () =>
      setFilters({
        from: dispatchFilterStartOf(fromDate),
        to: dispatchFilterNextDay(toDate),
        messageKey: messageKey.trim() || undefined,
        kind: (kind || undefined) as AdminDispatchFilters["kind"],
        channel: channel || undefined,
        status: status || undefined,
      }),
    [fromDate, toDate, messageKey, kind, channel, status],
  );

  const clear = useCallback(() => {
    setFromDate("");
    setToDate("");
    setMessageKey("");
    setKind("");
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
      messageKey,
      setMessageKey,
      kind,
      setKind,
      channel,
      setChannel,
      status,
      setStatus,
    },
  };
}
