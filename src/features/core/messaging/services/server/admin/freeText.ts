// src/features/core/messaging/services/server/admin/freeText.ts
//
// 管理者がその場で書いて送る連絡(D65・D80・D85)の種別ごとの定義と、選んだカテゴリーの検査。
// - 種別 announcement・direct・marketing の 3 つ。定義は messages/admin<Kind>.ts(欄は 3 本同じ)
// - 送る時は選んだカテゴリーの種別の定義を使い、定義の category を選んだカテゴリーに替える(テンプレートも同じ定義の鍵)
// - 宛先の種類(all・role・audience・users・bulk)は種別の性質 adminFreeText で確かめる
// - その場で書く連絡の文面は email・inApp だけ: それ以外の経路を持つカテゴリーはその場で書く連絡に使えない(テンプレートは版の経路)

import { MESSAGE_KIND_TRAITS, type MessageAdminAudience, type MessageCategory, type MessageKind } from "@/lib/messaging";
import { DomainError } from "@/lib/errors";

import { message as adminAnnouncement } from "../../../messages/adminAnnouncement";
import { message as adminDirect } from "../../../messages/adminDirect";
import { message as adminMarketing } from "../../../messages/adminMarketing";
import type { AnyMessageDefinition } from "../sendMessage/definition";

/** 管理者がその場で書いて送れる種別 */
export const ADMIN_FREE_TEXT_KINDS = ["announcement", "direct", "marketing"] as const;
export type AdminFreeTextKind = (typeof ADMIN_FREE_TEXT_KINDS)[number];

/** 種別ごとの定義(テンプレートの送りも同じ鍵) */
export const ADMIN_FREE_TEXT_DEFINITIONS: Readonly<Record<AdminFreeTextKind, typeof adminMarketing>> = {
  announcement: adminAnnouncement,
  direct: adminDirect,
  marketing: adminMarketing,
};

/** 3 本の鍵(enricher の当て先・テンプレートの使える鍵) */
export const ADMIN_FREE_TEXT_MESSAGE_KEYS = ADMIN_FREE_TEXT_KINDS.map((kind) => ADMIN_FREE_TEXT_DEFINITIONS[kind].key);

/** その場で書く連絡が文面を持つ経路 */
export const ADMIN_FREE_TEXT_CHANNELS = ["email", "inApp"] as const;

export function isAdminFreeTextKind(kind: string): kind is AdminFreeTextKind {
  return (ADMIN_FREE_TEXT_KINDS as readonly string[]).includes(kind);
}

/** その種別の定義の鍵(3 つの種別でなければ null) */
export function adminFreeTextMessageKeyOf(kind: string): string | null {
  return isAdminFreeTextKind(kind) ? ADMIN_FREE_TEXT_DEFINITIONS[kind].key : null;
}

/** そのカテゴリーで送る定義(定義の category を替えた写し) */
export function adminFreeTextDefinitionOf(category: MessageCategory): AnyMessageDefinition {
  if (!isAdminFreeTextKind(category.kind)) {
    throw new DomainError(`カテゴリー ${category.key} の種別 ${category.kind} は管理画面から送れません`, { status: 400 });
  }
  return { ...ADMIN_FREE_TEXT_DEFINITIONS[category.kind], category: category.key } as unknown as AnyMessageDefinition;
}

/** そのカテゴリーの文面が email・inApp だけで書けるか(その場で書く連絡に使えるか) */
export function fitsFreeText(category: MessageCategory): boolean {
  return category.channels.every((channel) => (ADMIN_FREE_TEXT_CHANNELS as readonly string[]).includes(channel));
}

/**
 * 管理の送信で選んだカテゴリーを確かめて返す。
 * @throws DomainError(400) 無いカテゴリー・3 つの種別でない・宛先の種類がその種別で送れない・(その場で書く時)email・inApp の外の経路
 */
export function adminFreeTextCategoryOf(
  categories: Readonly<Record<string, MessageCategory>>,
  key: string,
  options: { audience: MessageAdminAudience | null; adhoc: boolean },
): MessageCategory & { kind: AdminFreeTextKind } {
  const category = categories[key];
  if (!category) throw new DomainError(`カテゴリー ${key} はありません`, { status: 400 });
  if (!isAdminFreeTextKind(category.kind)) {
    throw new DomainError(`カテゴリー ${key} の種別 ${category.kind} は管理画面から送れません(announcement・direct・marketing)`, {
      status: 400,
    });
  }
  if (options.audience && !MESSAGE_KIND_TRAITS[category.kind].adminFreeText.includes(options.audience)) {
    throw new DomainError(`カテゴリー ${key}(種別 ${category.kind})はこの宛先(${options.audience})に送れません`, { status: 400 });
  }
  if (options.adhoc && !fitsFreeText(category)) {
    throw new DomainError(`カテゴリー ${key} の経路(${category.channels.join(" / ")})はその場で書く連絡では送れません(email・inApp)`, {
      status: 400,
    });
  }
  return category as MessageCategory & { kind: AdminFreeTextKind };
}

/** 選択肢: 3 つの種別のカテゴリー(受け口の順)と、その種別で送れる宛先の種類 */
export type AdminFreeTextCategoryOption = {
  key: string;
  label: string;
  kind: MessageKind;
  channels: string[];
  audiences: MessageAdminAudience[];
  /** その場で書く連絡に使える(経路が email・inApp だけ) */
  adhoc: boolean;
};

export function adminFreeTextCategoryOptions(
  categories: Readonly<Record<string, MessageCategory>>,
  filter: (option: AdminFreeTextCategoryOption) => boolean = () => true,
): AdminFreeTextCategoryOption[] {
  return Object.values(categories)
    .filter((category) => isAdminFreeTextKind(category.kind))
    .map((category) => ({
      key: category.key,
      label: category.label,
      kind: category.kind,
      channels: [...category.channels],
      audiences: [...MESSAGE_KIND_TRAITS[category.kind].adminFreeText],
      adhoc: fitsFreeText(category),
    }))
    .filter(filter);
}
