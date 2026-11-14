// src/features/core/messaging/constants/channelLabels.ts
//
// 上流の経路の表示名(管理の画面の絞り込み・配達の行・文言の上書きの欄)。値は各経路の受け口の label と同じにする
// (channels/<経路>/ の label。送る・一括送信のモーダルは API の選択肢の label を使い、ここは選択肢を持たない所と取れる前の控え)

export const MESSAGE_CHANNEL_LABELS: Readonly<Record<string, string>> = {
  email: "メール",
  inApp: "お知らせ",
  line: "LINE",
};

/** 経路の表示名(知らない経路は鍵のまま) */
export function messageChannelLabel(key: string): string {
  return MESSAGE_CHANNEL_LABELS[key] ?? key;
}

/** 管理の絞り込みの経路の選択肢(上流の経路の email・inApp) */
export const ADMIN_CHANNEL_FILTER_OPTIONS = ["email", "inApp"].map((value) => ({ value, label: messageChannelLabel(value) }));
