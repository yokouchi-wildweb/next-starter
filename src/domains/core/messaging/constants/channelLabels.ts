// src/domains/core/messaging/constants/channelLabels.ts
//
// 上流の送信チャンネルの表示名(管理の画面の絞り込み・配達の行・テキストの編集の欄)。値は各送信チャンネルの受け口の label と同じにする
// (channels/<送信チャンネル>/ の label。送る・一括送信のモーダルは API の選択肢の label を使い、ここは選択肢を持たない所と取れる前の控え)

export const MESSAGE_CHANNEL_LABELS: Readonly<Record<string, string>> = {
  email: "メール",
  inApp: "サービス内通知",
  line: "LINE",
};

/** 送信チャンネルの表示名(知らない送信チャンネルは鍵のまま) */
export function messageChannelLabel(key: string): string {
  return MESSAGE_CHANNEL_LABELS[key] ?? key;
}

/** 管理の絞り込みの送信チャンネルの選択肢(上流の送信チャンネルの email・inApp) */
export const ADMIN_CHANNEL_FILTER_OPTIONS = ["email", "inApp"].map((value) => ({ value, label: messageChannelLabel(value) }));
