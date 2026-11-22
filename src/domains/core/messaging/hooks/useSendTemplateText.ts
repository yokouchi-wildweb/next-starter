"use client";

// src/domains/core/messaging/hooks/useSendTemplateText.ts
//
// 管理: 送る画面の文面(D118 D119 D120)。送るモーダルの hook useMessageSendModal がこれを 1 つ持つ。
// - 出どころ: 選んだレイアウト({ layout }、白紙から書く)か、読み込んだ DB のテンプレートの版({ id, version })
// - レイアウトから書く時はいつも全文を書ける。テンプレートを読み込んだ直後は文を固定し(locked)、プレビューと専用の埋め込み情報の入力だけを出す
// - 『文面を直す』(unlock)で全文を直せる。つながりは残り、版の中身と違えば直した印(edited)が付く(送る口も中身の違いで付ける)
// - 『テンプレートの読み込みを解除』は呼び手が初めのレイアウトで reset する(今の文は、レイアウトが同じなら残す = toBlank)
// - 『テンプレートを更新』(updateTemplate)= 今の文をそのテンプレートの新しい版にする(1 回の保存で公開、送るとは別。テンプレートの保存と同じ、D134)。
//   成功したら新しい版へつなぎ直し、直した印は消える。変更が無ければ unchanged →「変更はありません」
// 欄のフォーム = useLayoutFieldsForm(検査は lib の layoutValuesSchema、使う送信チャンネルだけの欄は使う送信チャンネルで必須を決める)

import { useCallback, useMemo, useState } from "react";
import { useWatch } from "react-hook-form";

import { useDomainMutation } from "@/lib/crud";
import { varMap, type MessageVarDeclaration, type MessageLayoutFields } from "@/lib/messaging";
import { replaceVariables } from "@/lib/templateVariables";

import type { AdminSendLayoutOption } from "../services/client/sendClient";
import { updateMessageTemplate } from "../services/client/templateClient";

import { layoutFieldsDefaults, useLayoutFieldsForm } from "./useLayoutFieldsForm";
import { ADMIN_BULK_SEND_OPTIONS_KEY, ADMIN_SEND_OPTIONS_KEY, MESSAGE_TEMPLATES_KEY, MESSAGE_TEMPLATE_SEND_UPDATE_KEY } from "./messagingKeys";

/** 文面の出どころ */
export type SendTextSource =
  | { type: "layout"; layout: string; label: string }
  | { type: "template"; id: string; name: string; version: number };

/** 文面の状態(呼び手が reset で入れ替える) */
export type SendTextState = {
  source: SendTextSource;
  /** レイアウトの鍵 */
  layout: string;
  /** フォームの初めの中身(読み込んだ版・レイアウトの白紙 {}・同じ内容で送る元の送信の values) */
  start: Record<string, unknown>;
  /** 直した印の比べ先(テンプレートの版の中身。レイアウトから書く時は null) */
  versionValues: Record<string, unknown> | null;
  /** 全文を直せるか(レイアウトから書く時はいつも true) */
  unlocked: boolean;
  /** テンプレートの埋め込み情報の宣言(テンプレートの版の宣言。レイアウトから書く時は空) */
  varDeclarations: MessageVarDeclaration[];
  /** 専用の埋め込み情報の値(入力は文字) */
  vars: Record<string, string>;
};

export type UseSendTemplateTextOptions = {
  /** 選択肢のレイアウト(欄の宣言) */
  layouts: readonly AdminSendLayoutOption[];
  /** 初めの状態(mode と選択肢から呼び手が導く。null = まだ決まらない) */
  initial: SendTextState | null;
  /** 使う送信チャンネル(送信チャンネルだけの欄の必須と印) */
  channels: readonly string[];
  /** 門 messagingTemplates が開か(閉なら『テンプレートを更新』を出さない) */
  templatesOpen: boolean;
  /** 状態を手で変えた時(書きかけの印・プレビューを消す) */
  onChange?: () => void;
};

const NO_FIELDS: MessageLayoutFields = {};

/** レイアウトから書く状態(start = 初めの欄の中身、既定は白紙 {})。テンプレートの埋め込み情報は無い */
export function layoutTextState(layout: { key: string; label: string }, start: Record<string, unknown> = {}): SendTextState {
  return {
    source: { type: "layout", layout: layout.key, label: layout.label },
    layout: layout.key,
    start,
    versionValues: null,
    unlocked: true,
    varDeclarations: [],
    vars: {},
  };
}

/** 読み込んだテンプレートの版から作る状態(文は固定から) */
export function templateTextState(
  template: { id: string; name: string; currentVersion: number; layout: string; values: Record<string, unknown>; vars: MessageVarDeclaration[] },
  overrides: { start?: Record<string, unknown>; unlocked?: boolean; vars?: Record<string, string> } = {},
): SendTextState {
  return {
    source: { type: "template", id: template.id, name: template.name, version: template.currentVersion },
    layout: template.layout,
    start: overrides.start ?? template.values,
    versionValues: template.values,
    unlocked: overrides.unlocked ?? false,
    varDeclarations: template.vars,
    vars: overrides.vars ?? {},
  };
}

/** 専用の埋め込み情報の値(数の型だけ数にする。空は送らない = 既定値か、必須ならサーバーが 400) */
export function varValuesForInput(
  declarations: readonly MessageVarDeclaration[],
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
export function varPreviewValues(
  values: Readonly<Record<string, unknown>>,
  declarations: readonly MessageVarDeclaration[],
  entered: Readonly<Record<string, string>>,
): Record<string, unknown> {
  const filled: Record<string, string> = {};
  for (const declaration of declarations) {
    const raw = entered[declaration.key];
    const value = raw !== undefined && raw.trim() !== "" ? raw : declaration.default !== undefined ? String(declaration.default) : null;
    if (value !== null) filled[declaration.key] = value;
  }
  if (Object.keys(filled).length === 0) return values as Record<string, unknown>;
  const map = varMap(
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
export function missingVars(declarations: readonly MessageVarDeclaration[], values: Readonly<Record<string, string>>) {
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
  const setVars = useCallback(
    (key: string, value: string) => change((current) => ({ ...current, vars: { ...current.vars, [key]: value } })),
    [change],
  );

  /** レイアウトから書く形へ移る時の状態(レイアウトが同じなら今の文を残す。違えば白紙) */
  const toBlank = useCallback(
    (layout: { key: string; label: string }): SendTextState =>
      layoutTextState(layout, state && state.layout === layout.key ? values : {}),
    [state, values],
  );

  /** 送る前の検査(直している間だけ。誤りは欄に出る) */
  const validate = useCallback(async () => (state?.unlocked ? form.trigger() : true), [state?.unlocked, form]);

  const updateMutation = useDomainMutation<{ version: number | null; unchanged: boolean }, { id: string; values: Record<string, unknown> }>(
    MESSAGE_TEMPLATE_SEND_UPDATE_KEY,
    async ({ id, values: nextValues }) => {
      // 直す = 公開(中身が版と同じなら新しい版を作らず unchanged、D134)
      const saved = await updateMessageTemplate(id, { values: nextValues });
      return saved.unchanged ? { version: null, unchanged: true } : { version: saved.currentVersion, unchanged: false };
    },
    [MESSAGE_TEMPLATES_KEY, ADMIN_SEND_OPTIONS_KEY, ADMIN_BULK_SEND_OPTIONS_KEY],
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

  const missing = useMemo(() => (state ? missingVars(state.varDeclarations, state.vars) : []), [state]);

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
    missingVars: missing,
    /** 送る口の vars(宣言のある時だけ: テンプレートの版・専用を宣言したシステムテンプレート) */
    varsForInput: state && state.varDeclarations.length > 0 ? varValuesForInput(state.varDeclarations, state.vars) : undefined,
    /** 『テンプレートを更新』を出すか(テンプレートを読み込み、直していて、門 messagingTemplates が開) */
    canUpdateTemplate: Boolean(templatesOpen && state?.source.type === "template" && state.unlocked),
    isUpdatingTemplate: updateMutation.isMutating,
    reset,
    unlock,
    setVars,
    toBlank,
    validate,
    updateTemplate,
  };
}

export type SendTemplateTextState = ReturnType<typeof useSendTemplateText>;
