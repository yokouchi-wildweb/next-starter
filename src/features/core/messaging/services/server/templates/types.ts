// src/features/core/messaging/services/server/templates/types.ts

import type {
  MessageTemplate,
  MessageTemplateInsert,
  MessageTemplateVersion,
  MessageTemplateVersionInsert,
} from "../../../entities/model";

/** テンプレートを消す時に画像を結び直す回(欄の中身を残している回) */
export type TemplateKeptDispatch = {
  id: string;
  actor_id: string | null;
  metadata: Record<string, unknown> | null;
  values: Record<string, unknown>;
};

/** 保存されたテンプレートの DB の読み書き(テストは偽物を渡す)。Tx = 取引 */
export type MessageTemplateStore<Tx> = {
  transaction: <T>(run: (tx: Tx) => Promise<T>) => Promise<T>;
  /** 新しい順(作った時刻・id の keyset)。limit + 1 件まで返してよい */
  list: (query: {
    /** カテゴリーの鍵で絞る(null = 絞らない。空の並び = 当たる物なし) */
    categories: readonly string[] | null;
    limit: number;
    after: { createdAt: Date; id: string } | null;
  }) => Promise<MessageTemplate[]>;
  find: (id: string) => Promise<MessageTemplate | null>;
  findByKey: (key: string) => Promise<MessageTemplate | null>;
  /** 行を排他で読む(更新・削除の取引の中) */
  lockForUpdate: (tx: Tx, id: string) => Promise<MessageTemplate | null>;
  insert: (tx: Tx, values: MessageTemplateInsert) => Promise<MessageTemplate>;
  /** 行を消す(版は FK の cascade で消え、回の template_id は FK の set null で null になる) */
  remove: (tx: Tx, id: string) => Promise<void>;
  /**
   * このテンプレートから送り、欄の中身を残している回(消していない回)を排他で読む(削除の前に画像を回へ結び直す、D137)
   */
  lockKeptDispatches: (tx: Tx, templateId: string) => Promise<TemplateKeptDispatch[]>;
  /** 回の欄の中身と metadata(結んだ画像の対応)を書き換える */
  updateDispatchImages: (tx: Tx, dispatchId: string, patch: { values: Record<string, unknown>; metadata: Record<string, unknown> }) => Promise<void>;
  update: (tx: Tx, id: string, patch: Partial<MessageTemplateInsert>) => Promise<MessageTemplate>;
  /** 最新の版(無ければ null) */
  latestVersion: (id: string, tx?: Tx) => Promise<MessageTemplateVersion | null>;
  insertVersion: (tx: Tx, values: MessageTemplateVersionInsert) => Promise<MessageTemplateVersion>;
  /** 版の一覧(新しい順) */
  listVersions: (id: string) => Promise<MessageTemplateVersion[]>;
  findVersion: (id: string, version: number) => Promise<MessageTemplateVersion | null>;
};
