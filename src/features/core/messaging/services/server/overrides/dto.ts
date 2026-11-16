// src/features/core/messaging/services/server/overrides/dto.ts
//
// 管理画面の文言の上書きの返す形と入力(型だけ。client の service も型で読む)。
// 経路 = 連絡の種類の経路(fork の種類の上書きの後)。欄 = その経路の欄の全部(既定で全部直せる、D83)を平たく並べ、経路の一覧を横に置く

import type { ChannelFieldMeta } from "@/lib/messaging";

/** 連絡の経路 1 つ(種類の経路の順) */
export type AdminOverrideChannel = {
  key: string;
  /** 経路の表示名(経路の受け口の label) */
  label: string;
  /** 管理画面のプレビューの部品の鍵(経路の受け口の previewComponent。無ければ null = 欄をそのまま見せる) */
  previewComponent: string | null;
};

/** 編集できる連絡の一覧の 1 行 */
export type AdminOverrideMessageSummary = {
  key: string;
  /** 連絡の名前(定義の label、fork の上書きの後。画面は鍵でなくこれを出す、D46) */
  label: string;
  kind: string;
  /** 種類(取引の連絡は無い = null) */
  category: string | null;
  /** 種類の表示名(受け口の label。受け口に無ければ null) */
  categoryLabel: string | null;
  /** 種類の経路(届ける経路) */
  channels: AdminOverrideChannel[];
  /** 直せる欄の数 */
  editableCount: number;
  /** 直した欄の数(孤立も含む) */
  editedCount: number;
  /** 孤立した行の数(送る時はコードの値) */
  orphanCount: number;
  /** コードが直した後に変わった欄の数 */
  codeChangedCount: number;
};

/** 欄 1 つ(直せる欄 = 種類の経路の欄の全部(adminEditableOnly があればその中)、または直せなくなった欄の行) */
export type AdminOverrideField = {
  /** "<経路>.<欄>" */
  path: string;
  /** 経路の鍵 */
  channel: string;
  /** 欄の名前 */
  field: string;
  /** 欄の表示の約束(経路の受け口の fieldMeta。約束の無い欄 = 欄の名前を見出しに 1 行の入力) */
  meta: ChannelFieldMeta;
  /** 今も直せる欄か(false = 直せなくなった欄の行。既定に戻すだけできる) */
  editable: boolean;
  /** 今のコードの値(fork の override を重ねた後) */
  codeValue: unknown;
  /** 管理画面の値(行が無ければ null) */
  value: unknown;
  /** 送る時に使う値(通る管理画面の値、無ければコードの値) */
  effective: unknown;
  /** 行がある */
  edited: boolean;
  /** 直した時のコードの値と今のコードの値が違う */
  codeChanged: boolean;
  /** 行が今の検査を通らない(送る時はコードの値) */
  orphan: boolean;
  /** 孤立の理由 */
  problem: string | null;
  updatedAt: string | null;
};

export type AdminOverrideMessageDetail = {
  key: string;
  /** 連絡の名前(定義の label、fork の上書きの後。画面は鍵でなくこれを出す、D46) */
  label: string;
  kind: string;
  /** 種類(取引の連絡は無い = null) */
  category: string | null;
  /** 種類の表示名(受け口の label。受け口に無ければ null) */
  categoryLabel: string | null;
  /** 使ってよい {{鍵}}(vars は秘密を除く・共通の文脈・provides) */
  allowedKeys: string[];
  /** 種類の経路(届ける経路、欄はこの順) */
  channels: AdminOverrideChannel[];
  fields: AdminOverrideField[];
};

/** 欄 1 つの保存 */
export type SaveMessageOverrideInput = { fieldPath: string; value: unknown };
