// src/domains/core/messaging/services/server/admin/freeText.ts
//
// 自由連絡(D65・D80・D85・D117)の選んだカテゴリーの検査と選択肢。
// - 送れる種別 = 種別の性質 adminFreeText がある物(announcement・direct・promotion。sendMessage/templateDefinition.ts adminSendableKinds)
// - 中身はレイアウト(直に選ぶか DB のテンプレートの版)+ 欄の中身(sendMessage/templateDefinition.ts)。定義は持たない
// - 宛先の種類(all・role・group・users・bulk)は種別の性質 adminFreeText で確かめる
// - 送信チャンネルはカテゴリーの送信チャンネル(LINE・fork の送信チャンネルも)
// - 選択肢は送る画面が要る物を持つ: そのカテゴリーで書ける埋め込み情報の一覧(共通 + 当たる enrichers、D112)。レイアウトの選択肢は send.ts

import {
  categoryAdminLabel,
  MESSAGE_KIND_TRAITS,
  type MessageAdminTarget,
  type MessageCategory,
  type MessageEnricher,
  type MessageKind,
} from "@/lib/messaging";
import { DomainError } from "@/lib/errors";

import { messageVarCatalog } from "../sendMessage/enrichers";
import { isAdminSendableKind, TEMPLATE_MESSAGE_KEY } from "../sendMessage/templateDefinition";
import type { AdminVarEntry } from "../templates/dto";

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
    throw new DomainError(`カテゴリー「${categoryAdminLabel(category)}」は管理画面から送信できません`, {
      status: 400,
    });
  }
  if (options.target && !MESSAGE_KIND_TRAITS[category.kind].adminFreeText.includes(options.target)) {
    throw new DomainError(`カテゴリー「${categoryAdminLabel(category)}」はこの宛先には送信できません`, { status: 400 });
  }
  return category;
}

/** 選択肢: 送れる種別のカテゴリー(受け口の順)と、その種別で送れる宛先の種類 */
export type AdminFreeTextCategoryOption = {
  key: string;
  label: string;
  kind: MessageKind;
  channels: string[];
  /** 送る画面の送信方法が最初に入っている送信チャンネル(カテゴリーの defaultChannels、無ければ channels の全部、D119) */
  defaultChannels: string[];
  targets: MessageAdminTarget[];
  /** このカテゴリーで送る時に書ける埋め込み情報(共通 + 当たる enrichers。テンプレートの宣言の物は呼び手が足す) */
  catalog: AdminVarEntry[];
};

export function adminFreeTextCategoryOptions(
  categories: Readonly<Record<string, MessageCategory>>,
  filter: (option: AdminFreeTextCategoryOption) => boolean = () => true,
  enrichers: Readonly<Record<string, MessageEnricher>> = {},
): AdminFreeTextCategoryOption[] {
  return Object.values(categories)
    .filter((category) => isAdminSendableKind(category.kind))
    .map((category) => ({
        key: category.key,
        label: categoryAdminLabel(category),
        kind: category.kind,
        channels: [...category.channels],
        defaultChannels: [...(category.defaultChannels ?? category.channels)],
        targets: [...MESSAGE_KIND_TRAITS[category.kind].adminFreeText],
        catalog: messageVarCatalog({ key: TEMPLATE_MESSAGE_KEY, category: category.key, kind: category.kind }, enrichers).map((entry) => ({
          key: entry.key,
          alias: entry.alias,
          source: entry.source,
          description: entry.description ?? null,
        })),
    }))
    .filter(filter);
}
