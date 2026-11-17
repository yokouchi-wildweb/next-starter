// src/features/core/messaging/services/server/admin/freeText.ts
//
// 管理者がその場で送る連絡(D65・D80・D85・D117)の選んだカテゴリーの検査と選択肢。
// - 送れる種別 = 種別の性質 adminFreeText がある物(announcement・direct・promotion。sendMessage/systemTemplates.ts adminSendableKinds)
// - 中身はテンプレート(白紙のシステムテンプレートか DB のテンプレート)+ 欄の中身(sendMessage/templateDefinition.ts)。定義は持たない
// - 宛先の種類(all・role・group・users・bulk)は種別の性質 adminFreeText で確かめる
// - 経路はカテゴリーの経路(LINE・fork の経路も)
// - 選択肢は送る画面が欄を描くのに要る物を持つ: 白紙のひな形と欄の中身、そのカテゴリーで書ける埋め込み情報の一覧(共通 + 当たる enrichers、D112)

import {
  MESSAGE_KIND_TRAITS,
  type MessageAdminTarget,
  type MessageCategory,
  type MessageEmbeddedDeclaration,
  type MessageEnricher,
  type MessageKind,
  type MessageSystemTemplate,
} from "@/lib/messaging";
import { DomainError } from "@/lib/errors";

import { messageEmbeddedCatalog } from "../sendMessage/enrichers";
import { enabledSystemTemplates, isAdminSendableKind, systemTemplateOfKind } from "../sendMessage/systemTemplates";
import { TEMPLATE_MESSAGE_KEY } from "../sendMessage/templateDefinition";
import type { AdminEmbeddedEntry } from "../templates/dto";

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
  /** 送る画面の送信方法が最初に入っている経路(カテゴリーの defaultChannels、無ければ channels の全部、D119) */
  defaultChannels: string[];
  targets: MessageAdminTarget[];
  /** その種別の既定の白紙(受け口の順で種別の最初 = シンプル)(テンプレートを読み込まずに送る時の出どころ { system: 鍵 }、ひな形の鍵と白紙の欄の中身)。受け口に無ければ null */
  systemTemplate: { key: string; label: string; layout: string; values: Record<string, unknown> } | null;
  /** このカテゴリーで送る時に書ける埋め込み情報(共通 + 当たる enrichers。専用はテンプレートの宣言から呼び手が足す) */
  catalog: AdminEmbeddedEntry[];
};

export function adminFreeTextCategoryOptions(
  categories: Readonly<Record<string, MessageCategory>>,
  systemTemplates: Readonly<Record<string, MessageSystemTemplate>>,
  filter: (option: AdminFreeTextCategoryOption) => boolean = () => true,
  enrichers: Readonly<Record<string, MessageEnricher>> = {},
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
        defaultChannels: [...(category.defaultChannels ?? category.channels)],
        targets: [...MESSAGE_KIND_TRAITS[category.kind].adminFreeText],
        systemTemplate: blank ? { key: blank.key, label: blank.label, layout: blank.layout, values: blank.values } : null,
        catalog: messageEmbeddedCatalog({ key: TEMPLATE_MESSAGE_KEY, category: category.key, kind: category.kind }, enrichers).map((entry) => ({
          key: entry.key,
          alias: entry.alias,
          source: entry.source,
          description: entry.description ?? null,
        })),
      };
    })
    .filter(filter);
}

/** 選択肢のシステムテンプレート 1 つ(送る画面がテンプレートとして並べる。専用の埋め込み情報の宣言つき) */
export type AdminSystemTemplateOption = {
  key: string;
  kind: MessageKind;
  label: string;
  layout: string;
  values: Record<string, unknown>;
  embedded: MessageEmbeddedDeclaration[];
};

/** 管理者が送れる種別の使うシステムテンプレート全部(受け口の順、切った物 enabled: false は出さない。D119・D122) */
export function adminSystemTemplateOptions(systemTemplates: Readonly<Record<string, MessageSystemTemplate>>): AdminSystemTemplateOption[] {
  return enabledSystemTemplates(systemTemplates)
    .filter((template) => isAdminSendableKind(template.kind))
    .map((template) => ({
      key: template.key,
      kind: template.kind,
      label: template.label,
      layout: template.layout,
      values: { ...template.values },
      embedded: [...(template.embedded ?? [])],
    }));
}
