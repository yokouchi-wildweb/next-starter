// src/features/core/messaging/services/server/templates/dto.ts
//
// 保存されたテンプレートの管理へ返す形(型だけ。client の service も型で読む)。

import type { MessageTemplateStatus } from "../../../entities/model";
import type { MessageTemplateVariable } from "../../../entities/schema";

export type AdminTemplateSummary = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: string;
  channels: string[];
  status: MessageTemplateStatus;
  /** 最新の公開の版(null = まだ公開していない) */
  currentVersion: number | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string | null;
};

export type AdminTemplateDetail = AdminTemplateSummary & {
  /** 今の中身(下書き。公開した版は versions で読む) */
  content: Record<string, unknown>;
  variables: MessageTemplateVariable[];
  /** 本文で使ってよい {{鍵}}(共通の文脈 ∪ adminMessage の provides ∪ 宣言した変数) */
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
  channels: string[];
  editedBy: string | null;
  createdAt: string;
};

export type AdminTemplatePage = { items: AdminTemplateSummary[]; nextCursor: string | null };

/** 画面の選択肢(作る・直す画面が最初に読む) */
export type AdminTemplateOptions = {
  /** 使える経路(受け口にあり enabled: false でない物) */
  channels: { key: string; label: string }[];
  /** 種類 */
  categories: { key: string; label: string; description: string | null }[];
  /** 変数を宣言する前から使える {{鍵}}(共通の文脈 ∪ adminMessage の provides) */
  baseAllowedKeys: string[];
};
