// 生成物・編集不可: pnpm generate extensions が src/app/_layout/extensionPoints.ts から生成する
// frameSession: 差す側の <ドメイン>/plugs/frameSession/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const plug(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す)

import type { FrameSessionPlug } from "@/app/_layout/points";

import { plug as frameSession_auth_session } from "@/domains/core/auth/plugs/frameSession/session";

const frameSessionMap = {
  session: frameSession_auth_session,
} as const satisfies Readonly<Record<string, FrameSessionPlug>>;
/** 名前(項目のファイル名)を鍵にした型。一覧は門番で絞ってから使う */
export type FrameSessionMap = typeof frameSessionMap;
export const frameSession: { domain: string | null; name: string; requires: readonly string[]; plug: FrameSessionPlug }[] = [
  { domain: "auth", name: "session", requires: [], plug: frameSessionMap.session },
];
