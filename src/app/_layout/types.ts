// src/app/_layout/types.ts
//
// 根の枠の点(./extensionPoints.ts)の約束の型。枠はドメインを値も型も読まない(D22・D25): ドメインは自分の plugs の項目でこの形を差す

import type { ComponentType, ReactNode } from "react";

/** 枠が読むログインの状態(ヘッダー・ボトムナビの出し分け) */
export type FrameSession = { isAuthenticated: boolean };

/** 枠のログアウトの操作(利用者のヘッダーのメニュー) */
export type FrameLogout = { logout: () => Promise<unknown> | void; isLoading: boolean };

/**
 * 点 frameSession の項目(export const plug、ちょうど 1 つ: 上流は常設の auth)。どちらも client の hook
 * (枠の部品が毎回同じ順で呼ぶ。項目は固定なので hook の規則を守る)
 */
export type FrameSessionPlug = {
  useSession: () => FrameSession;
  useLogout: (options: { redirectTo?: string }) => FrameLogout;
};

/** 点 rootProviders の項目(export const provider): 子を包む Provider(client の部品) */
export type RootProvider = ComponentType<{ children: ReactNode }>;

/** 枠の名前付きの増設点の項目(export const part): 枠が決まった場所に並べて描く部品(props なしの client の部品。利用者・管理の枠の点も同じ形) */
export type FramePart = ComponentType;
