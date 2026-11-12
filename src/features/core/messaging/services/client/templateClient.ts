"use client";

// src/features/core/messaging/services/client/templateClient.ts
//
// 保存されたテンプレートの管理 API(/api/admin/messaging/templates)。一覧はカーソル。門 messagingTemplates が閉なら 404。
// 型は server の DTO(services/server/templates/dto.ts)・入力の型(schema.ts)を型だけ読む

import axios from "axios";

import { normalizeHttpError } from "@/lib/errors";

import type {
  AdminTemplateDetail,
  AdminTemplateOptions,
  AdminTemplatePage,
  AdminTemplateSummary,
  AdminTemplateVersion,
} from "@/features/core/messaging/services/server/templates/dto";
import type {
  CreateMessageTemplateInput,
  UpdateMessageTemplateInput,
} from "@/features/core/messaging/services/server/templates/schema";

const BASE = "/api/admin/messaging/templates";

export type {
  AdminTemplateDetail,
  AdminTemplateOptions,
  AdminTemplatePage,
  AdminTemplateSummary,
  AdminTemplateVersion,
  CreateMessageTemplateInput,
  UpdateMessageTemplateInput,
};

const one = (id: string) => `${BASE}/${encodeURIComponent(id)}`;

/** 一覧(新しい順、状態で絞れる) */
export async function listMessageTemplates(
  params: { status?: string; cursor?: string | null; limit?: number } = {},
): Promise<AdminTemplatePage> {
  try {
    const res = await axios.get<AdminTemplatePage>(BASE, {
      params: { status: params.status || undefined, cursor: params.cursor ?? undefined, limit: params.limit },
    });
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "テンプレートの一覧の取得に失敗しました");
  }
}

/** 画面の選択肢(使える経路・種類・変数の前から使える {{鍵}}) */
export async function getMessageTemplateOptions(): Promise<AdminTemplateOptions> {
  try {
    const res = await axios.get<AdminTemplateOptions>(`${BASE}/options`);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "テンプレートの選択肢の取得に失敗しました");
  }
}

/** 1 件(今の中身 = 下書き) */
export async function getMessageTemplate(id: string): Promise<AdminTemplateDetail> {
  try {
    const res = await axios.get<AdminTemplateDetail>(one(id));
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "テンプレートの取得に失敗しました");
  }
}

/** 下書きを作る */
export async function createMessageTemplate(input: CreateMessageTemplateInput): Promise<AdminTemplateDetail> {
  try {
    const res = await axios.post<AdminTemplateDetail>(BASE, input);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "テンプレートを作れませんでした");
  }
}

/** 下書きを直す */
export async function updateMessageTemplate(id: string, input: UpdateMessageTemplateInput): Promise<AdminTemplateDetail> {
  try {
    const res = await axios.patch<AdminTemplateDetail>(one(id), input);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "テンプレートを保存できませんでした");
  }
}

/** 公開(今の中身を新しい版にする。変更が無ければ 409) */
export async function publishMessageTemplate(id: string): Promise<AdminTemplateDetail> {
  try {
    const res = await axios.post<AdminTemplateDetail>(`${one(id)}/publish`);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "公開できませんでした");
  }
}

/** 取り下げ(直せない・公開できない。版は残る) */
export async function archiveMessageTemplate(id: string): Promise<AdminTemplateDetail> {
  try {
    const res = await axios.post<AdminTemplateDetail>(`${one(id)}/archive`);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "取り下げられませんでした");
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
