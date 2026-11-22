"use client";

// src/features/core/messaging/services/client/templateClient.ts
//
// 保存されたテンプレートの管理 API(/api/admin/messaging/templates)。一覧はカーソル。門 messagingTemplates が閉なら 404。
// 型は server の DTO(services/server/templates/dto.ts)・入力の型(schema.ts)を型だけ読む

import axios from "axios";

import { normalizeHttpError } from "@/lib/errors";

import type {
  AdminLayoutPreview,
  AdminTemplateDetail,
  AdminTemplateOptions,
  AdminTemplatePage,
  AdminTemplateSaveResult,
  AdminTemplateSummary,
  AdminTemplateVersion,
} from "@/features/core/messaging/services/server/templates/dto";
import type {
  CreateMessageTemplateInput,
  PreviewMessageLayoutInput,
  UpdateMessageTemplateInput,
} from "@/features/core/messaging/services/server/templates/schema";

const BASE = "/api/admin/messaging/templates";

export type {
  AdminLayoutPreview,
  AdminTemplateDetail,
  AdminTemplateOptions,
  AdminTemplatePage,
  AdminTemplateSaveResult,
  AdminTemplateSummary,
  AdminTemplateVersion,
  CreateMessageTemplateInput,
  PreviewMessageLayoutInput,
  UpdateMessageTemplateInput,
};

const one = (id: string) => `${BASE}/${encodeURIComponent(id)}`;

/** 一覧(新しい順、種別で絞れる。種別 = その種別のカテゴリーとシステムテンプレート、D135) */
export async function listMessageTemplates(
  params: { kind?: string; cursor?: string | null; limit?: number } = {},
): Promise<AdminTemplatePage> {
  try {
    const res = await axios.get<AdminTemplatePage>(BASE, {
      params: { kind: params.kind || undefined, cursor: params.cursor ?? undefined, limit: params.limit },
    });
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "テンプレートの一覧の取得に失敗しました");
  }
}

/** 画面の選択肢(使える送信チャンネル・カテゴリー・変数の前から使える {{鍵}}) */
export async function getMessageTemplateOptions(): Promise<AdminTemplateOptions> {
  try {
    const res = await axios.get<AdminTemplateOptions>(`${BASE}/options`);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "テンプレートの選択肢の取得に失敗しました");
  }
}

/** 1 件(中身 = 最新の版と同じ) */
export async function getMessageTemplate(id: string): Promise<AdminTemplateDetail> {
  try {
    const res = await axios.get<AdminTemplateDetail>(one(id));
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "テンプレートの取得に失敗しました");
  }
}

/** 作って公開する(版 1、D134)。公開した 1 件を返す */
export async function createMessageTemplate(input: CreateMessageTemplateInput): Promise<AdminTemplateDetail> {
  try {
    const res = await axios.post<AdminTemplateDetail>(BASE, input);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "テンプレートを作れませんでした");
  }
}

/** 直して公開する(中身が最新の版と違えば新しい版、同じなら unchanged: true、D134) */
export async function updateMessageTemplate(id: string, input: UpdateMessageTemplateInput): Promise<AdminTemplateSaveResult> {
  try {
    const res = await axios.patch<AdminTemplateSaveResult>(one(id), input);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "テンプレートを保存できませんでした");
  }
}

/** 消す(版も消え、送信は残る。D137) */
export async function deleteMessageTemplate(id: string): Promise<{ id: string; deleted: true }> {
  try {
    const res = await axios.delete<{ id: string; deleted: true }>(one(id));
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "削除できませんでした");
  }
}

/** 版の一覧(新しい順) */
export async function listMessageTemplateVersions(id: string): Promise<AdminTemplateVersion[]> {
  try {
    const res = await axios.get<{ items: AdminTemplateVersion[] }>(`${one(id)}/versions`);
    return res.data.items;
  } catch (error) {
    throw normalizeHttpError(error, "版の一覧の取得に失敗しました");
  }
}

/** 1 版 */
export async function getMessageTemplateVersion(id: string, version: number): Promise<AdminTemplateVersion> {
  try {
    const res = await axios.get<AdminTemplateVersion>(`${one(id)}/versions/${version}`);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "版の取得に失敗しました");
  }
}

/** レイアウトのプレビュー(保存しない中身を送信チャンネル 1 つで描く。テンプレートと送る画面が使う、D114) */
export async function previewMessageLayout(input: PreviewMessageLayoutInput): Promise<AdminLayoutPreview> {
  try {
    const res = await axios.post<AdminLayoutPreview>("/api/admin/messaging/layouts/preview", input);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "プレビューを作れませんでした");
  }
}
