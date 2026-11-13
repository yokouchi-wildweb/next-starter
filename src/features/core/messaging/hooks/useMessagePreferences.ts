"use client";

// src/features/core/messaging/hooks/useMessagePreferences.ts
//
// 本人の連絡の好み(経路 > 種別の枠 > グループ > 種類、応答のまま)を読み、止め方 5 つを切り替える:
// 1 マス(setCell)・種類まるごと(setCategoryWide)・経路まるごと(setChannelWide)・全部(setAll)・種別まるごと(setKind、上流の既定の画面は出さない)。
// 広い行の下の 1 マスの再開はサーバーが書き分ける(全部の行は書き分けない)。
// 変更の応答(変えた後の表)を SWR のキャッシュにそのまま書く(取り直さない)。
// pendingKey = 変えている最中の行(`<種類>:<経路>`。種類まるごと `<種類>:*`・経路まるごと `*:<経路>`・全体 `*:*`・種別まるごと `kind:<種別>`)。部品はこれで押せなくする

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

/** 種別まるごとの変更の pendingKey */
export const preferenceKindKey = (kind: string) => `kind:${kind}`;

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

  /** 種類まるごと(すべての経路)を止める(stop = true)/ 再開する */
  const setCategoryWide = useCallback(
    (category: string, stop: boolean) => set({ category, channel: MESSAGE_PREFERENCE_ALL, optedOut: stop }),
    [set],
  );

  /** 経路まるごと(その経路のすべての種類)を止める(stop = true)/ 再開する */
  const setChannelWide = useCallback(
    (channel: string, stop: boolean) => set({ category: MESSAGE_PREFERENCE_ALL, channel, optedOut: stop }),
    [set],
  );

  /** すべての連絡を止める(stopAll = true)/ 再開する */
  const setAll = useCallback(
    (stopAll: boolean) => set({ category: MESSAGE_PREFERENCE_ALL, channel: MESSAGE_PREFERENCE_ALL, optedOut: stopAll }),
    [set],
  );

  /** 種別まるごとを止める(stop = true)/ 再開する(上流の既定の画面は出さない。fork の部品が呼ぶ) */
  const setKind = useCallback((kind: string, stop: boolean) => set({ kind, optedOut: stop }), [set]);

  return {
    preferences: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    retry: () => mutate(),
    setCell,
    setCategoryWide,
    setChannelWide,
    setAll,
    setKind,
    pendingKey,
  };
}
