// src/features/core/messaging/services/server/admin/freeText.ts
//
// 管理者がその場で送る連絡(D65・D80・D85・D117)の選んだカテゴリーの検査と選択肢。
// - 送れる種別 = 種別の性質 adminFreeText がある物(announcement・direct・promotion。sendMessage/systemTemplates.ts adminSendableKinds)
// - 中身はテンプレート(白紙のシステムテンプレートか DB のテンプレート)+ 欄の中身(sendMessage/templateDefinition.ts)。定義は持たない
// - 宛先の種類(all・role・group・users・bulk)は種別の性質 adminFreeText で確かめる
// - 経路はカテゴリーの経路(LINE・fork の経路も)

import { MESSAGE_KIND_TRAITS, type MessageAdminTarget, type MessageCategory, type MessageKind, type MessageSystemTemplate } from "@/lib/messaging";
import { DomainError } from "@/lib/errors";

import { isAdminSendableKind, systemTemplateOfKind } from "../sendMessage/systemTemplates";

/**
 * 管理の送信で選んだカテゴリーを確かめて返す。
 * @throws DomainError(400) 無いカテゴリー・管理者が送れる種別でない・宛先の種類がその種別で送れない
 */
export function adminFreeTextCategoryOf(
  categories: Readonly<Record<string, MessageCategory>>,
  key: string,
  options: { target: MessageAdminTarget | null },
): MessageCategory {
  const category = categories[key];
  if (!category) throw new DomainError("選んだカテゴリーが見つかりません", { status: 400 });
  if (!isAdminSendableKind(category.kind)) {
    throw new DomainError(`カテゴリー「${category.label}」は管理画面から送信できません`, {
      status: 400,
    });
  }
  if (options.target && !MESSAGE_KIND_TRAITS[category.kind].adminFreeText.includes(options.target)) {
    throw new DomainError(`カテゴリー「${category.label}」はこの宛先には送信できません`, { status: 400 });
  }
  return category;
}

/** 選択肢: 送れる種別のカテゴリー(受け口の順)と、その種別で送れる宛先の種類・白紙のシステムテンプレート */
export type AdminFreeTextCategoryOption = {
  key: string;
  label: string;
  kind: MessageKind;
  channels: string[];
  targets: MessageAdminTarget[];
  /** その種別の白紙(テンプレートを読み込まずに送る時の出どころ { system: 鍵 })。受け口に無ければ null */
  systemTemplate: { key: string; label: string } | null;
};

export function adminFreeTextCategoryOptions(
  categories: Readonly<Record<string, MessageCategory>>,
  systemTemplates: Readonly<Record<string, MessageSystemTemplate>>,
  filter: (option: AdminFreeTextCategoryOption) => boolean = () => true,
): AdminFreeTextCategoryOption[] {
  return Object.values(categories)
    .filter((category) => isAdminSendableKind(category.kind))
    .map((category) => {
      const blank = systemTemplateOfKind(systemTemplates, category.kind);
      return {
        key: category.key,
        label: category.label,
        kind: category.kind,
        channels: [...category.channels],
        targets: [...MESSAGE_KIND_TRAITS[category.kind].adminFreeText],
        systemTemplate: blank ? { key: blank.key, label: blank.label } : null,
      };
    })
    .filter(filter);
}
