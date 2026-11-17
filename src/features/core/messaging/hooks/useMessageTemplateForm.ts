"use client";

// src/features/core/messaging/hooks/useMessageTemplateForm.ts
//
// 管理: テンプレートを作る・直す画面の書く欄と操作(部品はこれを呼んで描くだけ。CLAUDE.md core_ui_guards)。
// - 欄: 名前・説明・カテゴリー・中身・専用の埋め込み情報の宣言(鍵はサーバーが作る、D46)。初めの値は今の中身(下書き)。経路は選ばない(D85)
// - S5 で作り直すまでの最小の形(指令 58): ひな形は notice に固定。中身はメールの欄の部品(件名・見出し・段落・ボタン)で書き、
//   保存の時に notice の欄の中身へ読み替える(utils/noticeValues.ts。開く時は逆向き。画像などほかのブロックは落ちる)
// - 保存: 作る(POST)か直す(PATCH)。空の任意の欄は落とす
// - 公開・取り下げ: 1 件・版の一覧を取り直す。一覧(無限スクロール)へは onChanged で返った 1 件を渡す
// - 使える名前 = 選択肢の baseCatalog の鍵と別名 ∪ 宣言した専用の鍵と別名(サーバーの保存時の検査と同じ組)。知らない名前を返す
// - 書きかけがある間は離れる前に確かめる(@/lib/unsavedGuard。モーダルを閉じる前の確かめは closeConfirm)
// - 作った後は onCreated(id) を呼び、createdId を返す(モーダルがその 1 件を直す形に変わる。ページは移らない)

import { useCallback, useMemo, useState } from "react";

import { useDomainMutation } from "@/lib/crud/hooks";
import { err } from "@/lib/errors";
import { listVariables } from "@/lib/structuredDocument";
import { useToast } from "@/lib/toast";
import { useUnsavedGuard } from "@/lib/unsavedGuard";

import type { MessageEmbeddedType } from "@/lib/messaging";

import { emailFieldsFromNoticeValues, noticeValuesFromChannelContent } from "../utils/noticeValues";
import {
  archiveMessageTemplate,
  createMessageTemplate,
  publishMessageTemplate,
  updateMessageTemplate,
  type AdminTemplateDetail,
  type AdminTemplateOptions,
  type CreateMessageTemplateInput,
} from "../services/client/templateClient";

import { MESSAGE_TEMPLATES_KEY, messageTemplateKey, messageTemplateVersionsKey } from "./templateKeys";

/** 専用の埋め込み情報の宣言の 1 行(画面の形。default は文字で持つ) */
export type TemplateVariableDraft = {
  key: string;
  alias: string;
  type: MessageEmbeddedType;
  required: boolean;
  default: string;
};

/** 最小の編集画面のひな形(S5 でひな形を選べるようにする) */
export const TEMPLATE_EDITOR_LAYOUT = "notice";
/** 中身を書く欄の部品(メールの欄の形) */
export const TEMPLATE_EDITOR_CHANNEL = "email";

/** 経路ごとの中身(経路の欄の形のまま) */
export type TemplateContentDraft = Record<string, Record<string, unknown>>;

export type UseMessageTemplateFormOptions = {
  /** 直す 1 件(省略 = 作る) */
  template?: AdminTemplateDetail | null;
  options: AdminTemplateOptions | null;
  /** 作った後(下書きの id)。モーダルはこれで同じ 1 件を直す形に変わる */
  onCreated?: (id: string) => void;
  /** 作る・保存・公開・取り下げが通った後(返った 1 件と操作)。一覧はこれで行を足す・置き換える(無限スクロールは SWR の再検証が届かない) */
  onChanged?: (template: AdminTemplateDetail, action: MessageTemplateAction) => void;
};

/** テンプレートの操作 */
export type MessageTemplateAction = "create" | "update" | "publish" | "archive";

/** 経路を足したときの初めの中身 */
export function emptyChannelContent(channel: string): Record<string, unknown> {
  if (channel === "email") return { subject: "" };
  if (channel === "inApp") return { title: "", body: "" };
  if (channel === "line") return { text: "" };
  return {};
}

/** 文字が 1 つでも入っているか */
function hasText(value: unknown): boolean {
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.some(hasText);
  if (value && typeof value === "object") return Object.values(value).some(hasText);
  return false;
}

/** 文言を書いた経路(テンプレートの経路 = 文言のある経路、D85) */
export function filledChannels(content: TemplateContentDraft): string[] {
  return Object.keys(content).filter((channel) => hasText(content[channel]));
}

/** 送る中身: 渡した経路だけ、空の任意の文字の欄・空の cta を落とす */
export function contentForInput(content: TemplateContentDraft, channels: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const channel of channels) {
    const fields = { ...(content[channel] ?? emptyChannelContent(channel)) };
    for (const [name, value] of Object.entries(fields)) {
      const required = (channel === "email" && name === "subject") || (channel === "inApp" && (name === "title" || name === "body")) || (channel === "line" && name === "text");
      if (!required && typeof value === "string" && value.trim() === "") delete fields[name];
      if (Array.isArray(value) && value.length === 0) delete fields[name];
      if (name === "cta" && value && typeof value === "object") {
        const cta = value as { label?: string; url?: string };
        if (!cta.label?.trim() && !cta.url?.trim()) delete fields[name];
      }
    }
    out[channel] = fields;
  }
  return out;
}

function variablesForInput(variables: readonly TemplateVariableDraft[]) {
  return variables.map((variable) => ({
    key: variable.key.trim(),
    alias: variable.alias.trim(),
    type: variable.type,
    required: variable.required,
    ...(variable.default.trim() !== "" ? { default: variable.type === "number" ? Number(variable.default) : variable.default } : {}),
  }));
}

function draftsOf(template: AdminTemplateDetail | null | undefined): TemplateVariableDraft[] {
  return (template?.embedded ?? []).map((declaration) => ({
    key: declaration.key,
    alias: declaration.alias,
    type: declaration.type,
    required: declaration.required,
    default: declaration.default === undefined ? "" : String(declaration.default),
  }));
}

/** 今の中身(notice の欄の中身)→ 書く欄(メールの欄の形)。notice でないひな形は空(S5 まで直せない) */
function contentDraftOf(template: AdminTemplateDetail | null | undefined): TemplateContentDraft {
  if (!template || template.layout !== TEMPLATE_EDITOR_LAYOUT) return {};
  return { [TEMPLATE_EDITOR_CHANNEL]: emailFieldsFromNoticeValues(template.values) };
}

/** 書く欄 → notice の欄の中身 */
function valuesForInput(content: TemplateContentDraft): Record<string, unknown> {
  return noticeValuesFromChannelContent(contentForInput(content, [TEMPLATE_EDITOR_CHANNEL]));
}

/** 中身の文字を全部集める({{鍵}} を探すため) */
function stringsOf(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const item of value) stringsOf(item, out);
  else if (value && typeof value === "object") for (const item of Object.values(value)) stringsOf(item, out);
  return out;
}

export function useMessageTemplateForm({ template, options, onCreated, onChanged }: UseMessageTemplateFormOptions) {
  const { showToast } = useToast();
  const id = template?.id ?? null;
  const archived = template?.status === "archived";

  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [category, setCategory] = useState(template?.category ?? options?.categories[0]?.key ?? "");
  const [content, setContent] = useState<TemplateContentDraft>(() => contentDraftOf(template));
  const [variables, setVariables] = useState<TemplateVariableDraft[]>(() => draftsOf(template));
  const [createdId, setCreatedId] = useState<string | null>(null);

  const revalidateKeys = id ? [messageTemplateKey(id), messageTemplateVersionsKey(id), MESSAGE_TEMPLATES_KEY] : [MESSAGE_TEMPLATES_KEY];
  const createMutation = useDomainMutation<AdminTemplateDetail, CreateMessageTemplateInput>(
    `${MESSAGE_TEMPLATES_KEY}/create`,
    (input) => createMessageTemplate(input),
    MESSAGE_TEMPLATES_KEY,
  );
  const updateMutation = useDomainMutation<AdminTemplateDetail, CreateMessageTemplateInput>(
    `${MESSAGE_TEMPLATES_KEY}/${id ?? "new"}/update`,
    (input) => updateMessageTemplate(id!, input),
    revalidateKeys,
  );
  const publishMutation = useDomainMutation<AdminTemplateDetail, void>(
    `${MESSAGE_TEMPLATES_KEY}/${id ?? "new"}/publish`,
    () => publishMessageTemplate(id!),
    revalidateKeys,
  );
  const archiveMutation = useDomainMutation<AdminTemplateDetail, void>(
    `${MESSAGE_TEMPLATES_KEY}/${id ?? "new"}/archive`,
    () => archiveMessageTemplate(id!),
    revalidateKeys,
  );

  /** 送る入力(作る・直すで同じ。鍵はサーバーが作る) */
  const buildInput = useCallback(
    () => ({
      name: name.trim(),
      description: description.trim() === "" ? null : description,
      category,
      layout: TEMPLATE_EDITOR_LAYOUT,
      values: valuesForInput(content),
      embedded: variablesForInput(variables),
    }),
    [name, description, category, content, variables],
  );

  const initialJson = useMemo(
    () =>
      JSON.stringify({
        name: template?.name ?? "",
        description: template?.description ?? null,
        category: template?.category ?? options?.categories[0]?.key ?? "",
        layout: TEMPLATE_EDITOR_LAYOUT,
        values: valuesForInput(contentDraftOf(template)),
        embedded: variablesForInput(draftsOf(template)),
      }),
    [template, options],
  );
  const dirty = createdId === null && JSON.stringify(buildInput()) !== initialJson;
  useUnsavedGuard(dirty);

  const allowedKeys = useMemo(
    () => [
      ...new Set([
        ...(options?.baseCatalog ?? []).flatMap((entry) => [entry.key, entry.alias].filter(Boolean)),
        ...variables.flatMap((variable) => [variable.key.trim(), variable.alias.trim()]).filter(Boolean),
      ]),
    ],
    [options, variables],
  );
  const unknownKeys = useMemo(() => {
    const found = new Set<string>();
    for (const text of stringsOf(contentForInput(content, filledChannels(content)))) {
      for (const name of listVariables(text)) if (!allowedKeys.includes(name)) found.add(name);
    }
    return [...found];
  }, [content, allowedKeys]);

  const setChannelContent = useCallback(
    (channel: string, fields: Record<string, unknown>) => setContent((prev) => ({ ...prev, [channel]: fields })),
    [],
  );

  /** 保存(作る or 直す。ボタンが Promise の間 loading) */
  const save = useCallback(async () => {
    try {
      if (id) {
        const updated = await updateMutation.trigger(buildInput());
        onChanged?.(updated, "update");
        showToast("保存しました", "success");
      } else {
        const created = await createMutation.trigger(buildInput());
        setCreatedId(created.id);
        onCreated?.(created.id);
        onChanged?.(created, "create");
        showToast("下書きを作成しました", "success");
      }
    } catch (e) {
      showToast(err(e, "保存できませんでした"), "error");
    }
  }, [id, updateMutation, createMutation, buildInput, showToast, onCreated, onChanged]);

  /** 公開(今の中身を新しい版に。書きかけは先に保存する) */
  const publish = useCallback(async () => {
    if (!id) return;
    try {
      const published = await publishMutation.trigger();
      onChanged?.(published, "publish");
      showToast("公開しました", "success");
    } catch (e) {
      showToast(err(e, "公開できませんでした"), "error");
    }
  }, [id, publishMutation, showToast, onChanged]);

  /** 取り下げ */
  const archive = useCallback(async () => {
    if (!id) return;
    try {
      const archived = await archiveMutation.trigger();
      onChanged?.(archived, "archive");
      showToast("アーカイブしました", "success");
    } catch (e) {
      showToast(err(e, "アーカイブできませんでした"), "error");
    }
  }, [id, archiveMutation, showToast, onChanged]);

  return {
    mode: id ? ("edit" as const) : ("create" as const),
    archived,
    dirty,
    createdId,
    allowedKeys,
    unknownKeys,
    buildInput,
    save,
    publish,
    archive,
    /** 公開できるか(保存済み・書きかけ無し・取り下げていない・公開していない変更がある) */
    canPublish: Boolean(id) && !dirty && !archived && Boolean(template?.hasUnpublishedChanges),
    /** モーダルを閉じる前の確かめ(Modal の confirmOnClose に渡す) */
    closeConfirm: { enabled: dirty, message: "保存していない変更があります。閉じてもよろしいですか？" },
    fields: {
      name,
      setName,
      description,
      setDescription,
      category,
      setCategory,
      /** 書く欄の経路(最小の形はメールの欄だけ) */
      channels: [TEMPLATE_EDITOR_CHANNEL],
      content,
      setChannelContent,
      variables,
      setVariables,
    },
  };
}
