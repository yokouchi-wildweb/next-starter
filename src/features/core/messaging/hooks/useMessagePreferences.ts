"use client";

// src/features/core/messaging/hooks/useMessagePreferences.ts
//
// 本人の連絡の好み(種類 × 経路)を読み、1 マスか全体を切り替える。
// 変更の応答(変えた後の表)を SWR のキャッシュにそのまま書く(取り直さない)。
// pendingKey = 変えている最中のマス(`<種類>:<経路>`、全体は `*:*`)。部品はこれで押せなくする

import { useCallback, useState } from "react";
import useSWR from "swr";

import { useDomainMutation } from "@/lib/crud/hooks";

import {
  getMessagePreferences,
  setMessagePreference,
  type MessagePreferencesDto,
  type SetMessagePreferenceInput,
} from "../services/client/preferenceClient";

/** SWR のキー */
export const MESSAGE_PREFERENCES_KEY = "messaging/preferences";

/** 全体の停止の鍵('*' '*' の行) */
export const MESSAGE_PREFERENCE_ALL = "*";

export const preferenceCellKey = (category: string, channel: string) => `${category}:${channel}`;

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
      setPendingKey(preferenceCellKey(input.category, input.channel));
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

  return {
    preferences: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    retry: () => mutate(),
    setCell,
    setAll,
    pendingKey,
  };
}
