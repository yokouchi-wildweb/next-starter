// src/features/core/messaging/services/server/preferences/dto.ts
//
// 好み(種類 × 経路の配信停止)の利用者へ返す形と、変える入力の形(型だけ。client の service も型で読む)。
// - 表 = 種類の受け口(取引・required は種類を持たないので出ない)× 有効な経路の受け口
// - マスの optedOut = 送る側(checkStops)が止めるか。via = どの行で止まっているか
//   (cell = そのマスの行 / category = 種類の全経路 '*' / channel = 経路の全種類 '*' / all = 全体 '*' '*' / null = 受け取る)

import type { MessageKind } from "@/lib/messaging";

export type MessagePreferenceVia = "cell" | "category" | "channel" | "all";

export type MessagePreferenceChannelDto = {
  key: string;
  label: string;
  /** 本人がこの経路の宛先を持つか(無ければ止めていなくても届かない) */
  hasAddress: boolean;
  /** 宛先の無い利用者を案内する先(経路の項目の connectHref。門で閉じた住所は null) */
  connectHref: string | null;
};

export type MessagePreferenceCellDto = {
  channel: string;
  optedOut: boolean;
  via: MessagePreferenceVia | null;
};

export type MessagePreferenceCategoryDto = {
  key: string;
  label: string;
  description: string | null;
  /** 種別(利用者が止められる種別 activity・marketing だけが表に出る) */
  kind: MessageKind;
  /** マス = 開いている経路 ∩ 種類の経路(D86) */
  cells: MessagePreferenceCellDto[];
};

export type MessagePreferencesDto = {
  /** 全体の停止('*' '*' の行)がある */
  allOptedOut: boolean;
  channels: MessagePreferenceChannelDto[];
  categories: MessagePreferenceCategoryDto[];
};

/** 1 つの変更: 1 マス(種類・経路)か、全体(どちらも '*')を止める / 再開する */
export type SetMessagePreferenceInput = {
  category: string;
  channel: string;
  optedOut: boolean;
};
