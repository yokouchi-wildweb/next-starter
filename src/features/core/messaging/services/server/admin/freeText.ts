// src/features/core/messaging/services/server/admin/freeText.ts
//
// 管理者がその場で書いて送る連絡(D65・D80・D85)の種別ごとの定義と、選んだカテゴリーの検査。
// - 種別 announcement・direct・marketing の 3 つ。定義は messages/admin<Kind>.ts(authored = 文面を送るたびに受け取る、D92)
// - 送る時は選んだカテゴリーの種別の定義の鍵で、受けた文面を組む(sendMessage/authoredDefinition.ts。その場で書く連絡もテンプレートも同じ)
// - 宛先の種類(all・role・audience・users・bulk)は種別の性質 adminFreeText で確かめる
// - 経路はカテゴリーの経路(LINE・fork の経路も、文面があれば送れる)

import { MESSAGE_KIND_TRAITS, type MessageAdminAudience, type MessageCategory, type MessageKind } from "@/lib/messaging";
import { DomainError } from "@/lib/errors";

import { message as adminAnnouncement } from "../../../messages/adminAnnouncement";
import { message as adminDirect } from "../../../messages/adminDirect";
import { message as adminMarketing } from "../../../messages/adminMarketing";

/** 管理者がその場で書いて送れる種別 */
export const ADMIN_FREE_TEXT_KINDS = ["announcement", "direct", "marketing"] as const;
export type AdminFreeTextKind = (typeof ADMIN_FREE_TEXT_KINDS)[number];

/** 種別ごとの定義(authored。その場で書く連絡とテンプレートの送りが同じ鍵) */
export const ADMIN_FREE_TEXT_DEFINITIONS: Readonly<Record<AdminFreeTextKind, typeof adminMarketing>> = {
  announcement: adminAnnouncement,
  direct: adminDirect,
  marketing: adminMarketing,
};

/** 3 本の鍵(enricher の当て先・テンプレートの使える鍵) */
export const ADMIN_FREE_TEXT_MESSAGE_KEYS = ADMIN_FREE_TEXT_KINDS.map((kind) => ADMIN_FREE_TEXT_DEFINITIONS[kind].key);

export function isAdminFreeTextKind(kind: string): kind is AdminFreeTextKind {
  return (ADMIN_FREE_TEXT_KINDS as readonly string[]).includes(kind);
}

/** その種別の定義の鍵(3 つの種別でなければ null) */
export function adminFreeTextMessageKeyOf(kind: string): string | null {
  return isAdminFreeTextKind(kind) ? ADMIN_FREE_TEXT_DEFINITIONS[kind].key : null;
}

/**
 * 管理の送信で選んだカテゴリーを確かめて返す。
 * @throws DomainError(400) 無いカテゴリー・3 つの種別でない・宛先の種類がその種別で送れない
 */
export function adminFreeTextCategoryOf(
  categories: Readonly<Record<string, MessageCategory>>,
  key: string,
  options: { audience: MessageAdminAudience | null },
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
  return category as MessageCategory & { kind: AdminFreeTextKind };
}

/** 選択肢: 3 つの種別のカテゴリー(受け口の順)と、その種別で送れる宛先の種類 */
export type AdminFreeTextCategoryOption = {
  key: string;
  label: string;
  kind: MessageKind;
  channels: string[];
  audiences: MessageAdminAudience[];
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
    }))
    .filter(filter);
}
