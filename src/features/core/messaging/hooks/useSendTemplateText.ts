"use client";

// src/features/core/messaging/hooks/useSendTemplateText.ts
//
// 管理: 送る画面の文面(D118 D119 D120)。送るモーダルの hook useMessageSendModal がこれを 1 つ持つ。
// - 出どころ: 種別の白紙(システムテンプレート { system })か、読み込んだ DB のテンプレートの版({ id, version })
// - 白紙はいつも全文を書ける。テンプレートを読み込んだ直後は文を固定し(locked)、プレビューと専用の埋め込み情報の入力だけを出す
// - 『文面を直す』(unlock)で全文を直せる。つながりは残り、版の中身と違えば直した印(edited)が付く(送る口も中身の違いで付ける)
// - 『テンプレートの読み込みを解除』は呼び手が白紙で reset する(今の文は、ひな形が同じなら白紙の文として残す = toBlank)
// - 『テンプレートを更新』(updateTemplate)= 今の文をそのテンプレートの新しい版にする(保存 + 公開、送るとは別。T127 の保存と同じ)。
//   成功したら新しい版へつなぎ直し、直した印は消える。変更が無ければ 409 →「変更はありません」
// 欄のフォーム = useLayoutFieldsForm(検査は lib の layoutValuesSchema、送る経路だけの欄は送る経路で必須を決める)

import { useCallback, useMemo, useState } from "react";
import { useWatch } from "react-hook-form";

import { useDomainMutation } from "@/lib/crud/hooks";
import { HttpError } from "@/lib/errors";
import { embeddedVariableMap, type MessageEmbeddedDeclaration, type MessageLayoutFields } from "@/lib/messaging";
import { replaceVariables } from "@/lib/structuredDocument";

import type { AdminSendLayoutOption } from "../services/client/sendClient";
import { publishMessageTemplate, updateMessageTemplate } from "../services/client/templateClient";

import { ADMIN_MESSAGING_KEY } from "./adminMessagingKeys";
import { ADMIN_SEND_OPTIONS_KEY } from "./sendKeys";
import { MESSAGE_TEMPLATES_KEY } from "./templateKeys";
import { layoutFieldsDefaults, useLayoutFieldsForm } from "./useLayoutFieldsForm";

/** 文面の出どころ */
export type SendTextSource =
  | { type: "system"; key: string; label: string }
  | { type: "template"; id: string; name: string; version: number };

/** 文面の状態(呼び手が reset で入れ替える) */
export type SendTextState = {
  source: SendTextSource;
  /** ひな形の鍵 */
  layout: string;
  /** フォームの初めの中身(読み込んだ版・白紙・同じ内容で送る回の values) */
  start: Record<string, unknown>;
  /** 直した印の比べ先(テンプレートの版の中身。白紙は null) */
  versionValues: Record<string, unknown> | null;
  /** 全文を直せるか(白紙はいつも true) */
  unlocked: boolean;
  /** 専用の埋め込み情報の宣言(テンプレートの版。白紙は空) */
  embeddedDeclarations: MessageEmbeddedDeclaration[];
  /** 専用の埋め込み情報の値(入力は文字) */
  embedded: Record<string, string>;
};

export type UseSendTemplateTextOptions = {
  /** 選択肢のひな形(欄の宣言) */
  layouts: readonly AdminSendLayoutOption[];
  /** 初めの状態(mode と選択肢から呼び手が導く。null = まだ決まらない) */
  initial: SendTextState | null;
  /** 送る経路(経路だけの欄の必須と印) */
  channels: readonly string[];
  /** 門 messagingTemplates が開か(閉なら『テンプレートを更新』を出さない) */
  templatesOpen: boolean;
  /** 状態を手で変えた時(書きかけの印・プレビューを消す) */
  onChange?: () => void;
};

const NO_FIELDS: MessageLayoutFields = {};

/** 白紙から作る状態 */
export function blankTextState(blank: { key: string; label: string; layout: string; values: Record<string, unknown> }): SendTextState {
  return {
    source: { type: "system", key: blank.key, label: blank.label },
    layout: blank.layout,
    start: blank.values,
    versionValues: null,
    unlocked: true,
    embeddedDeclarations: [],
    embedded: {},
  };
}

/** 読み込んだテンプレートの版から作る状態(文は固定から) */
export function templateTextState(
  template: { id: string; name: string; currentVersion: number; layout: string; values: Record<string, unknown>; embedded: MessageEmbeddedDeclaration[] },
  overrides: { start?: Record<string, unknown>; unlocked?: boolean; embedded?: Record<string, string> } = {},
): SendTextState {
  return {
    source: { type: "template", id: template.id, name: template.name, version: template.currentVersion },
    layout: template.layout,
    start: overrides.start ?? template.values,
    versionValues: template.values,
    unlocked: overrides.unlocked ?? false,
    embeddedDeclarations: template.embedded,
    embedded: overrides.embedded ?? {},
  };
}

/** 専用の埋め込み情報の値(数の型だけ数にする。空は送らない = 既定値か、必須ならサーバーが 400) */
export function embeddedValuesForInput(
  declarations: readonly MessageEmbeddedDeclaration[],
  values: Readonly<Record<string, string>>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const declaration of declarations) {
    const raw = values[declaration.key];
    if (raw === undefined || raw.trim() === "") continue;
    out[declaration.key] = declaration.type === "number" && !Number.isNaN(Number(raw)) ? Number(raw) : raw;
  }
  return out;
}

/**
 * プレビューに渡す中身: 専用の埋め込み情報の {{鍵}} / {{別名}} を入れた値(空なら既定値)で埋める(文字・並び・object の中の文字の全部)。
 * 値も既定値も無い名前と、共通・enricher の名前(受信者ごとの値)は書いたまま残す
 */
export function embeddedPreviewValues(
  values: Readonly<Record<string, unknown>>,
  declarations: readonly MessageEmbeddedDeclaration[],
  entered: Readonly<Record<string, string>>,
): Record<string, unknown> {
  const filled: Record<string, string> = {};
  for (const declaration of declarations) {
    const raw = entered[declaration.key];
    const value = raw !== undefined && raw.trim() !== "" ? raw : declaration.default !== undefined ? String(declaration.default) : null;
    if (value !== null) filled[declaration.key] = value;
  }
  if (Object.keys(filled).length === 0) return values as Record<string, unknown>;
  const map = embeddedVariableMap(
    filled,
    declarations.map((declaration) => ({ key: declaration.key, alias: declaration.alias, source: "own" as const })),
  );
  const visit = (item: unknown): unknown => {
    if (typeof item === "string") return replaceVariables(item, map);
    if (Array.isArray(item)) return item.map(visit);
    if (item && typeof item === "object") return Object.fromEntries(Object.entries(item).map(([key, value]) => [key, visit(value)]));
    return item;
  };
  return visit(values) as Record<string, unknown>;
}

/** 入っていない必須の専用の埋め込み情報(既定値のある物は除く) */
export function missingEmbedded(declarations: readonly MessageEmbeddedDeclaration[], values: Readonly<Record<string, string>>) {
  return declarations.filter((declaration) => declaration.required && declaration.default === undefined && !values[declaration.key]?.trim());
}

const sameValues = (fields: MessageLayoutFields, a: Readonly<Record<string, unknown>>, b: Readonly<Record<string, unknown>>) =>
  JSON.stringify(layoutFieldsDefaults(fields, a)) === JSON.stringify(layoutFieldsDefaults(fields, b));

export function useSendTemplateText({ layouts, initial, channels, templatesOpen, onChange }: UseSendTemplateTextOptions) {
  const [stateOverride, setStateOverride] = useState<SendTextState | null>(null);
  const state = stateOverride ?? initial;

  const layoutOption = useMemo(() => layouts.find((item) => item.key === state?.layout) ?? null, [layouts, state?.layout]);
  const layoutForForm = useMemo(() => (layoutOption ? { key: layoutOption.key, fields: layoutOption.fields } : null), [layoutOption]);
  const fields = layoutOption?.fields ?? NO_FIELDS;
  const locked = state !== null && !state.unlocked;

  const { form, control, resetTo } = useLayoutFieldsForm({
    layout: layoutForForm,
    values: state?.start ?? null,
    channels,
    readOnly: locked,
  });
  const watched = useWatch({ control }) as Record<string, unknown> | undefined;

  /** 今の中身(固定の間は版の中身そのまま。直している間はフォームの値) */
  const values = useMemo<Record<string, unknown>>(
    () => (state === null ? {} : state.unlocked ? layoutFieldsDefaults(fields, watched ?? state.start) : state.start),
    [state, fields, watched],
  );
  /** テンプレートの版の中身から直したか */
  const edited = Boolean(state && state.source.type === "template" && state.unlocked && state.versionValues && !sameValues(fields, values, state.versionValues));

  /** 状態を入れ替える(白紙・読み込み・解除・種別を替えた時。呼び手が使う) */
  const reset = useCallback((next: SendTextState | null) => {
    setStateOverride(next);
  }, []);

  const change = useCallback(
    (next: (current: SendTextState) => SendTextState) => {
      setStateOverride((prev) => {
        const current = prev ?? initial;
        return current ? next(current) : current;
      });
      onChange?.();
    },
    [initial, onChange],
  );

  /** 『文面を直す』: 今の中身のまま全文を直せるようにする(つながりは残す) */
  const unlock = useCallback(() => change((current) => ({ ...current, unlocked: true })), [change]);

  /** 専用の埋め込み情報の値を入れる */
  const setEmbedded = useCallback(
    (key: string, value: string) => change((current) => ({ ...current, embedded: { ...current.embedded, [key]: value } })),
    [change],
  );

  /** 白紙へ移る時の状態(ひな形が同じなら今の文を白紙の文として残す。違えば白紙のまま) */
  const toBlank = useCallback(
    (blank: { key: string; label: string; layout: string; values: Record<string, unknown> }): SendTextState => {
      const next = blankTextState(blank);
      return state && state.layout === blank.layout ? { ...next, start: values } : next;
    },
    [state, values],
  );

  /** 送る前の検査(直している間だけ。誤りは欄に出る) */
  const validate = useCallback(async () => (state?.unlocked ? form.trigger() : true), [state?.unlocked, form]);

  const updateMutation = useDomainMutation<{ version: number | null; unchanged: boolean }, { id: string; values: Record<string, unknown> }>(
    `${MESSAGE_TEMPLATES_KEY}/send-update`,
    async ({ id, values: nextValues }) => {
      await updateMessageTemplate(id, { values: nextValues });
      try {
        const published = await publishMessageTemplate(id);
        return { version: published.currentVersion, unchanged: false };
      } catch (error) {
        if (error instanceof HttpError && error.status === 409) return { version: null, unchanged: true };
        throw error;
      }
    },
    [MESSAGE_TEMPLATES_KEY, ADMIN_SEND_OPTIONS_KEY, `${ADMIN_MESSAGING_KEY}/bulk-send/options`],
  );

  /**
   * 『テンプレートを更新』: 今の文をテンプレートの新しい版にする(送るとは別、D120)。成功 = 新しい版へつなぎ直し、直した印は消える。
   * 戻り値 unchanged = 版と同じで新しい版を作らなかった。誤りは投げる(呼び手が知らせる)
   */
  const updateTemplate = useCallback(async () => {
    if (!state || state.source.type !== "template") throw new Error("テンプレートを読み込んでいません");
    if (!(await form.trigger())) throw new Error("内容の入力に誤りがあります");
    const nextValues = layoutFieldsDefaults(fields, form.getValues());
    const result = await updateMutation.trigger({ id: state.source.id, values: nextValues });
    if (result.version !== null) {
      const version = result.version;
      setStateOverride((prev) => {
        const current = prev ?? initial;
        if (!current || current.source.type !== "template") return current;
        return { ...current, source: { ...current.source, version }, start: nextValues, versionValues: nextValues };
      });
    }
    return result;
  }, [state, form, fields, updateMutation, initial]);

  const missing = useMemo(() => (state ? missingEmbedded(state.embeddedDeclarations, state.embedded) : []), [state]);

  return {
    state,
    source: state?.source ?? null,
    layout: layoutOption,
    fields,
    form,
    control,
    resetTo,
    /** 文が固定か(テンプレートを読み込んだ直後) */
    locked,
    values,
    edited,
    /** 入っていない必須の専用の埋め込み情報 */
    missingEmbedded: missing,
    /** 送る口の embedded(テンプレートの時だけ) */
    embeddedForInput: state && state.source.type === "template" ? embeddedValuesForInput(state.embeddedDeclarations, state.embedded) : undefined,
    /** 『テンプレートを更新』を出すか(テンプレートを読み込み、直していて、門 messagingTemplates が開) */
    canUpdateTemplate: Boolean(templatesOpen && state?.source.type === "template" && state.unlocked),
    isUpdatingTemplate: updateMutation.isMutating,
    reset,
    unlock,
    setEmbedded,
    toBlank,
    validate,
    updateTemplate,
  };
}

export type SendTemplateTextState = ReturnType<typeof useSendTemplateText>;
