// src/features/core/messaging/services/server/overrides/types.ts

/** 管理画面の文言の 1 行(直した欄だけある) */
export type MessageOverrideRecord = {
  messageKey: string;
  fieldPath: string;
  value: unknown;
  codeValue: unknown;
  updatedBy: string | null;
  updatedAt: Date;
};

/** message_overrides の読み書き(テストは偽物を渡す) */
export type MessageOverrideStore = {
  /** 連絡の直した欄(送る口と管理の 1 件) */
  listByMessage: (messageKey: string) => Promise<MessageOverrideRecord[]>;
  /** 全部の行(管理の一覧の数) */
  listAll: () => Promise<MessageOverrideRecord[]>;
  /** 欄の値を入れる・差し替える(updated_at = now) */
  upsert: (values: { messageKey: string; fieldPath: string; value: unknown; codeValue: unknown; updatedBy: string | null }) => Promise<void>;
  /** 欄の行を消す(消した行が無ければ false) */
  remove: (messageKey: string, fieldPath: string) => Promise<boolean>;
};
