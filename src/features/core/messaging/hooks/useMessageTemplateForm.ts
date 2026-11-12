"use client";

// src/features/core/messaging/hooks/useMessageTemplateForm.ts
//
// 管理: テンプレートを作る・直す画面の書く欄と操作(部品はこれを呼んで描くだけ。CLAUDE.md core_ui_guards)。
// - 欄: 鍵(作る時だけ)・名前・説明・種類・経路・経路ごとの中身・変数の宣言。初めの値は今の中身(下書き)
// - 保存: 作る(POST)か直す(PATCH)。送るのは選んだ経路の中身だけで、空の任意の欄は落とす
// - 公開・取り下げ: 1 件・版の一覧を取り直す(一覧の画面は戻ったときに取り直す)
// - 使える {{鍵}} = 選択肢の baseAllowedKeys ∪ 宣言した変数(サーバーの保存時の検査と同じ組)。知らない鍵を返す
// - 書きかけがある間は離れる前に確かめる(@/lib/unsavedGuard)。作った後は createdId を返す(画面がその 1 件へ移る)

import { useCallback, useMemo, useState } from "react";

import { useDomainMutation } from "@/lib/crud/hooks";
import { err } from "@/lib/errors";
import { listVariables } from "@/lib/structuredDocument";
import { useToast } from "@/lib/toast";
import { useUnsavedGuard } from "@/lib/unsavedGuard";

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

/** 変数の宣言の 1 行(画面の形。default は文字で持つ) */
export type TemplateVariableDraft = {
  key: string;
  label: string;
  type: string;
  required: boolean;
  source: "dispatch" | "recipient";
  default: string;
};

/** 経路ごとの中身(経路の欄の形のまま) */
export type TemplateContentDraft = Record<string, Record<string, unknown>>;

export type UseMessageTemplateFormOptions = {
  /** 直す 1 件(省略 = 作る) */
  template?: AdminTemplateDetail | null;
  options: AdminTemplateOptions | null;
};

/** 経路を足したときの初めの中身 */
export function emptyChannelContent(channel: string): Record<string, unknown> {
  if (channel === "email") return { subject: "" };
  if (channel === "inApp") return { title: "", body: "" };
  if (channel === "line") return { text: "" };
  return {};
}

/** 送る中身: 選んだ経路だけ、空の任意の文字の欄・空の cta を落とす */
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
    label: variable.label.trim(),
    type: variable.type,
    required: variable.required,
    source: variable.source,
    ...(variable.default.trim() !== "" ? { default: variable.default } : {}),
  }));
}

function draftsOf(template: AdminTemplateDetail | null | undefined): TemplateVariableDraft[] {
  return (template?.variables ?? []).map((variable) => ({
    key: variable.key,
    label: variable.label,
    type: variable.type,
    required: variable.required,
    source: variable.source,
    default: variable.default === undefined || variable.default === null ? "" : String(variable.default),
  }));
}

/** 中身の文字を全部集める({{鍵}} を探すため) */
function stringsOf(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const item of value) stringsOf(item, out);
  else if (value && typeof value === "object") for (const item of Object.values(value)) stringsOf(item, out);
  return out;
}

export function useMessageTemplateForm({ template, options }: UseMessageTemplateFormOptions) {
  const { showToast } = useToast();
  const id = template?.id ?? null;
  const archived = template?.status === "archived";

  const [key, setKey] = useState(template?.key ?? "");
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [category, setCategory] = useState(template?.category ?? options?.categories[0]?.key ?? "");
  const [channels, setChannels] = useState<string[]>(template?.channels ?? []);
  const [content, setContent] = useState<TemplateContentDraft>(
    (template?.content as TemplateContentDraft | undefined) ?? {},
  );
  const [variables, setVariables] = useState<TemplateVariableDraft[]>(() => draftsOf(template));
  const [createdId, setCreatedId] = useState<string | null>(null);

  const revalidateKeys = id ? [messageTemplateKey(id), messageTemplateVersionsKey(id), MESSAGE_TEMPLATES_KEY] : [MESSAGE_TEMPLATES_KEY];
  const createMutation = useDomainMutation<AdminTemplateDetail, CreateMessageTemplateInput>(
    `${MESSAGE_TEMPLATES_KEY}/create`,
    (input) => createMessageTemplate(input),
    MESSAGE_TEMPLATES_KEY,
  );
  const updateMutation = useDomainMutation<AdminTemplateDetail, Omit<CreateMessageTemplateInput, "key">>(
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

  /** 送る入力(作る時は鍵つき) */
  const buildInput = useCallback(
    () => ({
      name: name.trim(),
      description: description.trim() === "" ? null : description,
      category,
      channels,
      content: contentForInput(content, channels),
      variables: variablesForInput(variables),
    }),
    [name, description, category, channels, content, variables],
  );

  const initialJson = useMemo(
    () =>
      JSON.stringify({
        key: template?.key ?? "",
        name: template?.name ?? "",
        description: template?.description ?? null,
        category: template?.category ?? options?.categories[0]?.key ?? "",
        channels: template?.channels ?? [],
        content: contentForInput((template?.content as TemplateContentDraft | undefined) ?? {}, template?.channels ?? []),
        variables: variablesForInput(draftsOf(template)),
      }),
    [template, options],
  );
  const dirty = createdId === null && JSON.stringify({ key, ...buildInput() }) !== initialJson;
  useUnsavedGuard(dirty);

  const allowedKeys = useMemo(
    () => [...new Set([...(options?.baseAllowedKeys ?? []), ...variables.map((variable) => variable.key.trim()).filter(Boolean)])],
    [options, variables],
  );
  const unknownKeys = useMemo(() => {
    const found = new Set<string>();
    for (const text of stringsOf(contentForInput(content, channels))) {
      for (const name of listVariables(text)) if (!allowedKeys.includes(name)) found.add(name);
    }
    return [...found];
  }, [content, channels, allowedKeys]);

  const toggleChannel = useCallback((channel: string, on: boolean) => {
    setChannels((prev) => (on ? (prev.includes(channel) ? prev : [...prev, channel]) : prev.filter((c) => c !== channel)));
    if (on) setContent((prev) => (prev[channel] ? prev : { ...prev, [channel]: emptyChannelContent(channel) }));
  }, []);
  const setChannelContent = useCallback(
    (channel: string, fields: Record<string, unknown>) => setContent((prev) => ({ ...prev, [channel]: fields })),
    [],
  );

  /** 保存(作る or 直す。ボタンが Promise の間 loading) */
  const save = useCallback(async () => {
    try {
      if (id) {
        await updateMutation.trigger(buildInput());
        showToast("保存しました", "success");
      } else {
        const created = await createMutation.trigger({ key: key.trim(), ...buildInput() });
        setCreatedId(created.id);
        showToast("下書きを作りました", "success");
      }
    } catch (e) {
      showToast(err(e, "保存できませんでした"), "error");
    }
  }, [id, updateMutation, createMutation, key, buildInput, showToast]);

  /** 公開(今の中身を新しい版に。書きかけは先に保存する) */
  const publish = useCallback(async () => {
    if (!id) return;
    try {
      await publishMutation.trigger();
      showToast("公開しました", "success");
    } catch (e) {
      showToast(err(e, "公開できませんでした"), "error");
    }
  }, [id, publishMutation, showToast]);

  /** 取り下げ */
  const archive = useCallback(async () => {
    if (!id) return;
    try {
      await archiveMutation.trigger();
      showToast("取り下げました", "success");
    } catch (e) {
      showToast(err(e, "取り下げられませんでした"), "error");
    }
  }, [id, archiveMutation, showToast]);

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
    fields: {
      key,
      setKey,
      name,
      setName,
      description,
      setDescription,
      category,
      setCategory,
      channels,
      toggleChannel,
      content,
      setChannelContent,
      variables,
      setVariables,
    },
  };
}
