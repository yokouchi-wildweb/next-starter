// src/features/core/messaging/services/server/templates/dto.ts
//
// 保存されたテンプレートの管理へ返す形(型だけ。client の service も型で読む)。経路は持たない: content の鍵 = 文言のある経路

import type { ChannelFieldMeta } from "@/lib/messaging";

import type { MessageTemplateStatus } from "../../../entities/model";
import type { MessageTemplateVariable } from "../../../entities/schema";

/** 画面が読む経路 1 つ(鍵・表示名・欄の表示の約束・プレビューの部品の鍵)。送る画面の選択肢も同じ形 */
export type AdminChannelOption = {
  key: string;
  label: string;
  fieldMeta: Readonly<Record<string, ChannelFieldMeta>>;
  previewComponent: string | null;
};

export type AdminTemplateSummary = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  /** 種類の表示名(受け口の label。受け口に無ければ null。画面は鍵でなくこれを出す、D46) */
  categoryLabel: string | null;
  status: MessageTemplateStatus;
  /** 最新の公開の版(null = まだ公開していない) */
  currentVersion: number | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string | null;
  /** システムテンプレート(受け口 messaging/templates の白紙、D117・D125)。直せない・公開・取り下げできない(API が 409) */
  system: boolean;
  /** システムテンプレートの種別(DB のテンプレートは null) */
  kind: string | null;
  /** システムテンプレートのひな形の鍵と白紙の欄の中身(DB のテンプレートは null。S4 まで経路ごとの content) */
  layout: string | null;
  values: Record<string, unknown> | null;
};

export type AdminTemplateDetail = AdminTemplateSummary & {
  /** 今の中身(下書き。公開した版は versions で読む) */
  content: Record<string, unknown>;
  variables: MessageTemplateVariable[];
  /** 本文で使ってよい {{鍵}}(共通の文脈 ∪ 管理者が送れる種別のどれにも当たる enrichers の provides ∪ 宣言した変数) */
  allowedKeys: string[];
  /** 今の中身が最新の版と違う(公開していない変更がある。版が無ければ true) */
  hasUnpublishedChanges: boolean;
};

/** 公開した版(不変) */
export type AdminTemplateVersion = {
  version: number;
  content: Record<string, unknown>;
  variables: MessageTemplateVariable[];
  category: string;
  /** 種類の表示名(受け口の label。無ければ null) */
  categoryLabel: string | null;
  editedBy: string | null;
  createdAt: string;
};

export type AdminTemplatePage = { items: AdminTemplateSummary[]; nextCursor: string | null };

/** 画面の選択肢(作る・直す画面が最初に読む) */
export type AdminTemplateOptions = {
  /** 使える経路(受け口にあり enabled: false でない物)。欄の表示の約束とプレビューの部品の鍵も(D83 D85) */
  channels: AdminChannelOption[];
  /** 種類(種別 announcement・direct・promotion の物だけ) */
  categories: { key: string; label: string; description: string | null }[];
  /** 変数を宣言する前から使える {{鍵}}(共通の文脈 ∪ 管理者が送れる種別のどれにも当たる enrichers の provides) */
  baseAllowedKeys: string[];
};
