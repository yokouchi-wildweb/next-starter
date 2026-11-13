"use client";

// src/features/core/messaging/hooks/useMessagePreferences.ts
//
// 本人の連絡の好み(経路 > 種別の枠 > グループ > 種類)を読み、1 マス・全体・種別まるごとを切り替える。
// categoryRows = 種類が先の画面のための組み直し(今の既定の画面が読む。並びは経路・種別の枠・グループの順に初めて出た順)。
// 変更の応答(変えた後の表)を SWR のキャッシュにそのまま書く(取り直さない)。
// pendingKey = 変えている最中のマス(`<種類>:<経路>`、全体は `*:*`)。部品はこれで押せなくする

import { useCallback, useMemo, useState } from "react";
import useSWR from "swr";

import { useDomainMutation } from "@/lib/crud/hooks";

import {
  getMessagePreferences,
  setMessagePreference,
  type MessagePreferenceCategoryRowDto,
  type MessagePreferencesDto,
  type SetMessagePreferenceInput,
} from "../services/client/preferenceClient";

/** SWR のキー */
export const MESSAGE_PREFERENCES_KEY = "messaging/preferences";

/** 全体の停止の鍵('*' '*' の行) */
export const MESSAGE_PREFERENCE_ALL = "*";

export const preferenceCellKey = (category: string, channel: string) => `${category}:${channel}`;

/** 種別まるごとの変更の pendingKey */
export const preferenceKindKey = (kind: string) => `kind:${kind}`;

/** 入れ子(経路 > 種別の枠 > グループ > 種類)から種類ごとの行(マスは経路の並び)を組み直す */
export function categoryRowsOf(preferences: MessagePreferencesDto): MessagePreferenceCategoryRowDto[] {
  const rows = new Map<string, MessagePreferenceCategoryRowDto>();
  for (const channel of preferences.channels) {
    for (const frame of channel.kinds) {
      for (const group of frame.groups) {
        for (const category of group.categories) {
          let row = rows.get(category.key);
          if (!row) {
            row = { key: category.key, label: category.label, description: category.description, kind: frame.kind, cells: [] };
            rows.set(category.key, row);
          }
          row.cells.push({ channel: channel.key, optedOut: category.optedOut, via: category.via });
        }
      }
    }
  }
  return [...rows.values()];
}

export function useMessagePreferences(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;
  const query = useSWR<MessagePreferencesDto>(enabled ? MESSAGE_PREFERENCES_KEY : null, () => getMessagePreferences());
  const mutation = useDomainMutation<MessagePreferencesDto, SetMessagePreferenceInput>(
    `${MESSAGE_PREFERENCES_KEY}/set`,
    (input) => setMessagePreference(input),
  );
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const { mutate } = query;
  const { trigger } = mutation;

  const set = useCallback(
    async (input: SetMessagePreferenceInput) => {
      setPendingKey("kind" in input ? preferenceKindKey(input.kind) : preferenceCellKey(input.category, input.channel));
      try {
        const next = await trigger(input);
        await mutate(next, { revalidate: false });
        return next;
      } finally {
        setPendingKey(null);
      }
    },
    [trigger, mutate],
  );

  /** 1 マスを受け取る(receive = true)/ 止める */
  const setCell = useCallback(
    (category: string, channel: string, receive: boolean) => set({ category, channel, optedOut: !receive }),
    [set],
  );

  /** すべての連絡を止める(stopAll = true)/ 再開する */
  const setAll = useCallback(
    (stopAll: boolean) => set({ category: MESSAGE_PREFERENCE_ALL, channel: MESSAGE_PREFERENCE_ALL, optedOut: stopAll }),
    [set],
  );

  /** 種別まるごとを止める(stop = true)/ 再開する(上流の既定の画面は出さない。fork の部品が呼ぶ) */
  const setKind = useCallback((kind: string, stop: boolean) => set({ kind, optedOut: stop }), [set]);

  const categoryRows = useMemo(() => (query.data ? categoryRowsOf(query.data) : []), [query.data]);

  return {
    preferences: query.data ?? null,
    categoryRows,
    isLoading: query.isLoading,
    error: query.error,
    retry: () => mutate(),
    setCell,
    setAll,
    setKind,
    pendingKey,
  };
}
