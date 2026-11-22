// src/features/core/messaging/services/server/preferences/dto.ts
//
// 好み(カテゴリー × 送信チャンネルの配信停止)の利用者へ返す形と、変える入力の形(型だけ。client の service も型で読む)。
// - 入れ子 = 送信チャンネル > 種別の枠 > グループ(categoryGroups の受け口。無いカテゴリーは key null の 1 つ、見出しのグループより先)> カテゴリー(D60・D62・D82)
//   送信チャンネルは有効な送信チャンネルの受け口の全部(カテゴリーの無い送信チャンネルは kinds が空)。種別の枠は利用者が止められる種別(userStoppable)だけ、MESSAGE_KINDS の順
//   カテゴリーが送信チャンネルに出る = カテゴリーの送信チャンネルにその送信チャンネルがある(列 = カテゴリーの送信チャンネル ∩ 開いている送信チャンネル、D86)
// - optedOut = 送る側(checkStops)が止めるか。via = どの行で止まっているか
//   (cell = そのマスの行 / category = カテゴリーの全送信チャンネル '*' / group = グループまるごと(この送信チャンネルか '*')/ kind = 種別まるごと / channel = 送信チャンネルの全カテゴリー '*' /
//   all = 全体 '*' '*' / null = 受け取る)
// - 広い停止の状態: カテゴリーまるごと = categories(カテゴリーごとに 1 つ)、送信チャンネルまるごと = channels[].optedOut、全体 = allOptedOut
// - 種別まるごとの停止の状態は kinds(上流の既定の画面はスイッチを出さない、D62・D71。fork は部品を置ける)
// - グループまるごとの停止(D123): 全送信チャンネル('*')の状態は groups、送信チャンネルごとの状態は channels[].kinds[].groups[].optedOut。
//   止めるのはグループの行なので、後からグループに入ったカテゴリーも止まる

import type { MessageKind } from "@/lib/messaging";

export type MessagePreferenceVia = "cell" | "category" | "group" | "kind" | "channel" | "all";

/** 1 つのカテゴリーの、1 つの送信チャンネルでの止まり方 */
export type MessagePreferenceCategoryDto = {
  key: string;
  label: string;
  description: string | null;
  optedOut: boolean;
  via: MessagePreferenceVia | null;
};

/** 見出しのグループ。key null = グループの無いカテゴリー */
export type MessagePreferenceGroupDto = {
  key: string | null;
  label: string | null;
  /** このグループ × この送信チャンネルの停止の行がある(key null は false) */
  optedOut: boolean;
  categories: MessagePreferenceCategoryDto[];
};

/** 送信チャンネルの中の種別の枠(並べ方だけ。止める単位は kinds の種別まるごと) */
export type MessagePreferenceKindFrameDto = {
  kind: MessageKind;
  groups: MessagePreferenceGroupDto[];
};

export type MessagePreferenceChannelDto = {
  key: string;
  label: string;
  /** 本人がこの送信チャンネルの宛先を持つか(無ければ止めていなくても届かない) */
  hasAddress: boolean;
  /** 宛先の無い利用者を案内する先(送信チャンネルの項目の connectHref。門で閉じた住所は null) */
  connectHref: string | null;
  /** 送信チャンネルまるごとの停止('*', この送信チャンネル の行)がある */
  optedOut: boolean;
  kinds: MessagePreferenceKindFrameDto[];
};

/** 種別まるごとの停止の状態(カテゴリーのある利用者が止められる種別だけ) */
export type MessagePreferenceKindDto = {
  kind: MessageKind;
  optedOut: boolean;
};

/** カテゴリーまるごとの停止の状態(利用者が止められる種別のカテゴリーごとに 1 つ) */
export type MessagePreferenceCategoryStopDto = {
  key: string;
  /** (このカテゴリー, '*') の行がある */
  optedOut: boolean;
};

/** グループまるごと(全送信チャンネル '*')の停止の状態(利用者が止められるカテゴリーを持つ見出しのグループごとに 1 つ、D123) */
export type MessagePreferenceGroupStopDto = {
  key: string;
  label: string;
  kind: MessageKind;
  /** (グループ, '*') の行がある */
  optedOut: boolean;
};

export type MessagePreferencesDto = {
  /** 全体の停止('*' '*' の行)がある */
  allOptedOut: boolean;
  categories: MessagePreferenceCategoryStopDto[];
  kinds: MessagePreferenceKindDto[];
  groups: MessagePreferenceGroupStopDto[];
  channels: MessagePreferenceChannelDto[];
};

/**
 * 1 つの変更:
 * - 1 マス(カテゴリー・送信チャンネル)・カテゴリーまるごと(channel '*')・送信チャンネルまるごと(category '*')・全体(どちらも '*')を止める / 再開する
 * - 種別まるごと(kind)を止める / 再開する(利用者が止められる種別だけ)
 * - グループまるごと(group、channel 省略か '*' = 全送信チャンネル)を止める / 再開する(利用者が止められるカテゴリーを持つグループだけ、D123)
 */
export type SetMessagePreferenceInput =
  | { category: string; channel: string; optedOut: boolean }
  | { kind: string; optedOut: boolean }
  | { group: string; channel?: string; optedOut: boolean };

/** サーバーの呼び手だけが渡す(HTTP の本文からは受けない) */
export type SetMessagePreferenceOptions = {
  /** 書いた入口(既定 user。例 signup) */
  source?: string;
};
