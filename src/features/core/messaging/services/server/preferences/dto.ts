// src/features/core/messaging/services/server/preferences/dto.ts
//
// 好み(種類 × 経路の配信停止)の利用者へ返す形と、変える入力の形(型だけ。client の service も型で読む)。
// - 入れ子 = 経路 > 種別の枠 > グループ(categoryGroups の受け口。無い種類は key null の 1 つ、見出しのグループより先)> 種類(D60・D62・D82)
//   経路は有効な経路の受け口の全部(種類の無い経路は kinds が空)。種別の枠は利用者が止められる種別(userStoppable)だけ、MESSAGE_KINDS の順
//   種類が経路に出る = 種類の経路にその経路がある(列 = 種類の経路 ∩ 開いている経路、D86)
// - optedOut = 送る側(checkStops)が止めるか。via = どの行で止まっているか
//   (cell = そのマスの行 / category = 種類の全経路 '*' / kind = 種別まるごと / channel = 経路の全種類 '*' / all = 全体 '*' '*' / null = 受け取る)
// - 広い停止の状態: 種類まるごと = categories(種類ごとに 1 つ)、経路まるごと = channels[].optedOut、全体 = allOptedOut
// - 種別まるごとの停止の状態は kinds(上流の既定の画面はスイッチを出さない、D62・D71。fork は部品を置ける)

import type { MessageKind } from "@/lib/messaging";

export type MessagePreferenceVia = "cell" | "category" | "kind" | "channel" | "all";

/** 1 つの種類の、1 つの経路での止まり方 */
export type MessagePreferenceCategoryDto = {
  key: string;
  label: string;
  description: string | null;
  optedOut: boolean;
  via: MessagePreferenceVia | null;
};

/** 見出しのグループ。key null = グループの無い種類 */
export type MessagePreferenceGroupDto = {
  key: string | null;
  label: string | null;
  categories: MessagePreferenceCategoryDto[];
};

/** 経路の中の種別の枠(並べ方だけ。止める単位は kinds の種別まるごと) */
export type MessagePreferenceKindFrameDto = {
  kind: MessageKind;
  groups: MessagePreferenceGroupDto[];
};

export type MessagePreferenceChannelDto = {
  key: string;
  label: string;
  /** 本人がこの経路の宛先を持つか(無ければ止めていなくても届かない) */
  hasAddress: boolean;
  /** 宛先の無い利用者を案内する先(経路の項目の connectHref。門で閉じた住所は null) */
  connectHref: string | null;
  /** 経路まるごとの停止('*', この経路 の行)がある */
  optedOut: boolean;
  kinds: MessagePreferenceKindFrameDto[];
};

/** 種別まるごとの停止の状態(種類のある利用者が止められる種別だけ) */
export type MessagePreferenceKindDto = {
  kind: MessageKind;
  optedOut: boolean;
};

/** 種類まるごとの停止の状態(利用者が止められる種別の種類ごとに 1 つ) */
export type MessagePreferenceCategoryStopDto = {
  key: string;
  /** (この種類, '*') の行がある */
  optedOut: boolean;
};

export type MessagePreferencesDto = {
  /** 全体の停止('*' '*' の行)がある */
  allOptedOut: boolean;
  categories: MessagePreferenceCategoryStopDto[];
  kinds: MessagePreferenceKindDto[];
  channels: MessagePreferenceChannelDto[];
};

/** 種類が先の画面のためのマス(入れ子から組み直す。client の hook の categoryRowsOf) */
export type MessagePreferenceCellDto = {
  channel: string;
  optedOut: boolean;
  via: MessagePreferenceVia | null;
};

/** 種類が先の画面のための行(入れ子から組み直す。マスは経路の並び) */
export type MessagePreferenceCategoryRowDto = {
  key: string;
  label: string;
  description: string | null;
  kind: MessageKind;
  cells: MessagePreferenceCellDto[];
};

/**
 * 1 つの変更:
 * - 1 マス(種類・経路)・種類まるごと(channel '*')・経路まるごと(category '*')・全体(どちらも '*')を止める / 再開する
 * - 種別まるごと(kind)を止める / 再開する(利用者が止められる種別だけ)
 */
export type SetMessagePreferenceInput =
  | { category: string; channel: string; optedOut: boolean }
  | { kind: string; optedOut: boolean };

/** サーバーの呼び手だけが渡す(HTTP の本文からは受けない) */
export type SetMessagePreferenceOptions = {
  /** 書いた入口(既定 user。例 signup) */
  source?: string;
};
