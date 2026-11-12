// src/features/core/messaging/services/server/templates/types.ts

import type {
  MessageTemplate,
  MessageTemplateInsert,
  MessageTemplateStatus,
  MessageTemplateVersion,
  MessageTemplateVersionInsert,
} from "../../../entities/model";

/** 保存されたテンプレートの DB の読み書き(テストは偽物を渡す)。Tx = 取引 */
export type MessageTemplateStore<Tx> = {
  transaction: <T>(run: (tx: Tx) => Promise<T>) => Promise<T>;
  /** 新しい順(作った時刻・id の keyset)。limit + 1 件まで返してよい */
  list: (query: {
    status: MessageTemplateStatus | null;
    limit: number;
    after: { createdAt: Date; id: string } | null;
  }) => Promise<MessageTemplate[]>;
  find: (id: string) => Promise<MessageTemplate | null>;
  findByKey: (key: string) => Promise<MessageTemplate | null>;
  /** 行を排他で読む(公開・更新の取引の中) */
  lockForUpdate: (tx: Tx, id: string) => Promise<MessageTemplate | null>;
  insert: (tx: Tx, values: MessageTemplateInsert) => Promise<MessageTemplate>;
  update: (tx: Tx, id: string, patch: Partial<MessageTemplateInsert>) => Promise<MessageTemplate>;
  /** 最新の版(無ければ null) */
  latestVersion: (id: string, tx?: Tx) => Promise<MessageTemplateVersion | null>;
  insertVersion: (tx: Tx, values: MessageTemplateVersionInsert) => Promise<MessageTemplateVersion>;
  /** 版の一覧(新しい順) */
  listVersions: (id: string) => Promise<MessageTemplateVersion[]>;
  findVersion: (id: string, version: number) => Promise<MessageTemplateVersion | null>;
};
