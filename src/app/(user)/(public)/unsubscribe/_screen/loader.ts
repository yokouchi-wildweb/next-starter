// src/app/(user)/(public)/unsubscribe/_screen/loader.ts
// /unsubscribe(メールの配信停止の確認のページ)の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 範囲 root(src/app/guard.ts)の createLoader(access public。ログイン不要、トークンが権限)。門の外で常に開く(D90)。
// searchParams.token(署名つきトークン)を確かめ、止める種類と経路の表示名を返す。書き込みは無い(止めるのは API の POST)

import "server-only";

import type { ScreenProps } from "@/lib/screens/types";
import { createLoader } from "@/app/guard";
import { describeUnsubscribeToken } from "@/features/core/messaging/services/server/unsubscribe";

export type UnsubscribeScreenSearchParams = {
  /** 署名つきトークン(未解釈) */
  token?: string | string[];
};

export type UnsubscribeScreenData =
  | { valid: false }
  | { valid: true; token: string; categoryLabel: string; channelLabel: string };

export const loadUnsubscribeScreen = createLoader({
  access: "public",
  key: async (props: ScreenProps<Record<string, never>, UnsubscribeScreenSearchParams>): Promise<[string | null]> => {
    const { token } = await props.searchParams;
    return [typeof token === "string" && token !== "" ? token : null];
  },
  load: async (_ctx, token): Promise<UnsubscribeScreenData> => {
    const description = describeUnsubscribeToken(token);
    if (!description.valid || token === null) return { valid: false };
    return { valid: true, token, categoryLabel: description.categoryLabel, channelLabel: description.channelLabel };
  },
});
