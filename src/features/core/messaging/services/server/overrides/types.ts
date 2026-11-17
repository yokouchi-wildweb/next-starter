// src/features/core/messaging/services/server/overrides/types.ts

/** 管理画面の文言の 1 行(直した欄だけある) */
export type MessageOverrideRecord = {
  messageKey: string;
  /** ひな形の欄の鍵(保存した時の版の鍵) */
  fieldPath: string;
  /** 保存した時のひな形の版(null = 版の無い古い形の行) */
  layoutVersion: number | null;
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
  /**
   * 欄の値を入れる・差し替える(updated_at = now。1 つの取引)。bind = 書く前に取引の中で呼ぶ(画像を行に結び、書く値を返す。
   * rowId = 今の行の id か新しい行の id、previousValue = 今の値か null)
   */
  upsert: (
    values: { messageKey: string; fieldPath: string; layoutVersion: number; value: unknown; codeValue: unknown; updatedBy: string | null },
    bind?: (tx: unknown, row: { rowId: string; previousValue: unknown }) => Promise<unknown>,
  ) => Promise<void>;
  /** 欄の行を消す(消した行が無ければ false。1 つの取引)。release = 消した行の値で取引の中で呼ぶ(画像を外す) */
  remove: (
    messageKey: string,
    fieldPath: string,
    release?: (tx: unknown, row: { rowId: string; value: unknown }) => Promise<void>,
  ) => Promise<boolean>;
  /**
   * 1 連絡の欄をまとめて書く(1 つの取引。どれかが失敗すれば全部が戻る、D132 の 1 回の保存)。removals = 消す行の欄の鍵、upserts = 入れる・差し替える値。
   * 消すのが先(同じ欄の前の版の行を消してから入れる)。bind / release は upsert / remove と同じ(取引の中で画像を結ぶ・外す)
   */
  apply: (
    messageKey: string,
    changes: {
      removals: readonly string[];
      upserts: readonly { fieldPath: string; layoutVersion: number; value: unknown; codeValue: unknown; updatedBy: string | null }[];
    },
    hooks?: {
      bind?: (tx: unknown, row: { fieldPath: string; rowId: string; previousValue: unknown; value: unknown }) => Promise<unknown>;
      release?: (tx: unknown, row: { rowId: string; value: unknown }) => Promise<void>;
    },
  ) => Promise<void>;
};
