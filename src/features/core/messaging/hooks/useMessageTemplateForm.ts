"use client";

// src/features/core/messaging/hooks/useMessageTemplateForm.ts
//
// 管理: テンプレートを作る・直す画面の書く欄と操作(部品はこれを呼んで描くだけ。CLAUDE.md core_ui_guards)。
// - 順 = 種別 →(種類: その種別に 2 つ以上ある時だけ選ぶ、1 つなら自動)→ ひな形(管理者が選べる物)→ 中身(D115)
// - 中身 = ひな形の欄(useLayoutFieldsForm)。経路は種類が決め、経路だけの欄とプレビューのタブはその分(D115)
// - ひな形を替える: 中身があれば確かめてから消す(pendingLayout → confirmLayoutChange、D113)。中身の付け替えはしない
// - 保存 = 作る(POST)か直す(PATCH)の後に公開(新しい版、D113)。変更が無ければ「変更はありません」。名前・説明・種類・ひな形・中身・専用の埋め込み情報
// - 専用の埋め込み情報 = 『専用の埋め込み情報を管理』のモーダルで足す・直す(embeddedEditor。適用で検査を通った物だけ反映、D126)
// - 埋め込み情報のタグ = 選択肢の baseCatalog(共通 + enrichers)+ 専用。中身の中の知らない {{名前}} を返す
// - システムテンプレート(system)・アーカイブした物は読むだけ(保存しない、D117)
// - 書きかけがある間は離れる前に確かめる(@/lib/unsavedGuard。モーダルを閉じる前の確かめは closeConfirm)
// - 作った後は onCreated(id) を呼ぶ(モーダルがその 1 件を直す形に変わる。ページは移らない)

import { useCallback, useMemo, useState } from "react";
import { useWatch } from "react-hook-form";

import { useDomainMutation } from "@/lib/crud/hooks";
import { err } from "@/lib/errors";
import {
  checkEmbeddedCatalog,
  layoutValuesSchema,
  MESSAGE_KINDS,
  messageEmbeddedDeclarationSchema,
  type MessageEmbeddedDeclaration,
  type MessageEmbeddedEntry,
  type MessageEmbeddedType,
  type MessageLayout,
} from "@/lib/messaging";
import { listVariables } from "@/lib/structuredDocument";
import { useToast } from "@/lib/toast";
import { useUnsavedGuard } from "@/lib/unsavedGuard";

import { MESSAGE_KIND_LABELS } from "../constants/kindLabels";
import {
  archiveMessageTemplate,
  createMessageTemplate,
  publishMessageTemplate,
  updateMessageTemplate,
  type AdminTemplateDetail,
  type AdminTemplateOptions,
  type CreateMessageTemplateInput,
} from "../services/client/templateClient";

import { useLayoutFieldsForm } from "./useLayoutFieldsForm";
import { MESSAGE_TEMPLATES_KEY, messageTemplateKey, messageTemplateVersionsKey } from "./templateKeys";

/** テンプレートを作れる種別(管理者が送れる 3 種別、D115) */
const TEMPLATE_KINDS = ["announcement", "direct", "promotion"] as const;

/** 専用の埋め込み情報の宣言の 1 行(画面の形。既定値は文字で持つ) */
export type EmbeddedDeclarationDraft = {
  key: string;
  alias: string;
  type: MessageEmbeddedType;
  required: boolean;
  default: string;
  /** 選択肢(type select だけ) */
  options: { value: string; label: string }[];
};

export type UseMessageTemplateFormOptions = {
  /** 直す 1 件(省略 = 作る) */
  template?: AdminTemplateDetail | null;
  options: AdminTemplateOptions | null;
  /** 作った後(id)。モーダルはこれで同じ 1 件を直す形に変わる */
  onCreated?: (id: string) => void;
  /** 作る・保存・取り下げが通った後(返った 1 件と操作)。一覧はこれで行を足す・置き換える(無限スクロールは SWR の再検証が届かない) */
  onChanged?: (template: AdminTemplateDetail, action: MessageTemplateAction) => void;
};

/** テンプレートの操作 */
export type MessageTemplateAction = "create" | "update" | "publish" | "archive";

/** 空か(文字は空白だけ・並びは 0 個・object は中が全部空) */
function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.values(value).every(isEmptyValue);
  return false;
}

/** 送る中身: 空の欄を落とす(任意の欄は無い形で送る。必須の空は検査が止める) */
export function compactLayoutValues(values: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => !isEmptyValue(value)));
}

function draftsOf(declarations: readonly MessageEmbeddedDeclaration[] | undefined): EmbeddedDeclarationDraft[] {
  return (declarations ?? []).map((declaration) => ({
    key: declaration.key,
    alias: declaration.alias,
    type: declaration.type,
    required: declaration.required,
    default: declaration.default === undefined ? "" : String(declaration.default),
    options: declaration.options ? declaration.options.map((option) => ({ ...option })) : [],
  }));
}

/** 画面の行 → 宣言(空の既定値は無し、数の型は数にする) */
function declarationOf(draft: EmbeddedDeclarationDraft): Record<string, unknown> {
  const fallback = draft.default.trim();
  return {
    key: draft.key.trim(),
    alias: draft.alias.trim(),
    type: draft.type,
    required: draft.required,
    ...(draft.type === "select" ? { options: draft.options.map((option) => ({ value: option.value.trim(), label: option.label.trim() })) } : {}),
    ...(fallback !== "" ? { default: draft.type === "number" && Number.isFinite(Number(fallback)) ? Number(fallback) : fallback } : {}),
  };
}

/** 中身の文字を全部集める({{名前}} を探すため) */
function stringsOf(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const item of value) stringsOf(item, out);
  else if (value && typeof value === "object") for (const item of Object.values(value)) stringsOf(item, out);
  return out;
}

/** 種別に種類が 1 つだけならその鍵(画面に出さず自動で決める、D115)。2 つ以上なら空 = 選ばせる */
function autoCategoryOf(categories: readonly { key: string; kind: string }[], kind: string): string {
  const list = categories.filter((category) => category.kind === kind);
  return list.length === 1 ? list[0].key : "";
}

/** 新しい宣言の行 */
export function emptyEmbeddedDraft(): EmbeddedDeclarationDraft {
  return { key: "", alias: "", type: "line", required: false, default: "", options: [] };
}

export function useMessageTemplateForm({ template, options, onCreated, onChanged }: UseMessageTemplateFormOptions) {
  const { showToast } = useToast();
  const id = template?.id ?? null;
  const archived = template?.status === "archived";
  const system = Boolean(template?.system);
  const readOnly = system || archived;

  const categories = useMemo(() => options?.categories ?? [], [options]);
  /** 種別の選択肢(種類のある物だけ、lib の並び) */
  const kindOptions = useMemo(
    () =>
      MESSAGE_KINDS.filter((kind) => (TEMPLATE_KINDS as readonly string[]).includes(kind) && categories.some((category) => category.kind === kind)).map(
        (kind) => ({ value: kind, label: MESSAGE_KIND_LABELS[kind] }),
      ),
    [categories],
  );
  const initialKind = categories.find((category) => category.key === template?.category)?.kind ?? template?.kind ?? kindOptions[0]?.value ?? "";

  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [kind, setKindState] = useState(initialKind);
  const [category, setCategory] = useState(template?.category ?? autoCategoryOf(categories, initialKind));
  const [layout, setLayout] = useState(template?.layout ?? (options?.layouts.length === 1 ? options.layouts[0].key : ""));
  const [pendingLayout, setPendingLayout] = useState<string | null>(null);
  const [embedded, setEmbedded] = useState<EmbeddedDeclarationDraft[]>(() => draftsOf(template?.embedded));
  const [createdId, setCreatedId] = useState<string | null>(null);

  const categoryChoices = useMemo(
    () => categories.filter((item) => item.kind === kind).map((item) => ({ value: item.key, label: item.label })),
    [categories, kind],
  );
  const channels = useMemo(() => categories.find((item) => item.key === category)?.channels ?? [], [categories, category]);
  const layoutOption = useMemo(() => options?.layouts.find((item) => item.key === layout) ?? null, [options, layout]);
  // 保存した中身は保存した時のひな形の間だけ(ひな形を替えたら空から、D113)
  const savedValues = useMemo(() => (template && template.layout === layout ? template.values : null), [template, layout]);

  const valuesForm = useLayoutFieldsForm({ layout: layoutOption, values: savedValues, channels, readOnly });
  const watched = useWatch({ control: valuesForm.control }) as Record<string, unknown>;
  const values = useMemo(() => compactLayoutValues(watched ?? {}), [watched]);

  const setKind = useCallback(
    (next: string) => {
      setKindState(next);
      setCategory((current) => (categories.some((item) => item.key === current && item.kind === next) ? current : autoCategoryOf(categories, next)));
    },
    [categories],
  );

  /** ひな形を替える(中身があれば確かめる。無ければすぐ) */
  const requestLayoutChange = useCallback(
    (next: string) => {
      if (next === layout) return;
      if (Object.keys(values).length > 0) setPendingLayout(next);
      else setLayout(next);
    },
    [layout, values],
  );
  const confirmLayoutChange = useCallback(() => {
    if (pendingLayout) setLayout(pendingLayout);
    setPendingLayout(null);
  }, [pendingLayout]);
  const cancelLayoutChange = useCallback(() => setPendingLayout(null), []);

  // 埋め込み情報の一覧(共通 + enrichers + 専用)
  const baseCatalog: MessageEmbeddedEntry[] = useMemo(
    () =>
      (options?.baseCatalog ?? []).map((entry) => ({
        key: entry.key,
        alias: entry.alias,
        source: entry.source,
        ...(entry.description ? { description: entry.description } : {}),
      })),
    [options],
  );
  const catalog: MessageEmbeddedEntry[] = useMemo(
    () => [
      ...baseCatalog,
      ...embedded.map((draft) => ({
        key: draft.key.trim(),
        alias: draft.alias.trim(),
        source: "own" as const,
        declaration: declarationOf(draft) as MessageEmbeddedDeclaration,
      })),
    ],
    [baseCatalog, embedded],
  );
  const unknownNames = useMemo(() => {
    const names = new Set(catalog.flatMap((entry) => [entry.key, entry.alias]).filter(Boolean));
    const found = new Set<string>();
    for (const text of stringsOf(values)) for (const item of listVariables(text)) if (!names.has(item)) found.add(item);
    return [...found];
  }, [catalog, values]);

  // 専用の埋め込み情報を管理するモーダル(開いた時に今の宣言を写し、適用で戻す)
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorRows, setEditorRows] = useState<EmbeddedDeclarationDraft[]>([]);
  const [editorErrors, setEditorErrors] = useState<string[]>([]);
  const openEditor = useCallback(() => {
    setEditorRows(embedded.map((row) => ({ ...row, options: row.options.map((option) => ({ ...option })) })));
    setEditorErrors([]);
    setEditorOpen(true);
  }, [embedded]);
  const updateRow = useCallback(
    (index: number, patch: Partial<EmbeddedDeclarationDraft>) =>
      setEditorRows((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row))),
    [],
  );
  const addRow = useCallback(() => setEditorRows((rows) => [...rows, emptyEmbeddedDraft()]), []);
  const removeRow = useCallback((index: number) => setEditorRows((rows) => rows.filter((_, i) => i !== index)), []);
  /** 適用: 宣言の形と名前の重なり(共通・enrichers・専用どうし)を確かめ、通れば反映して閉じる */
  const applyEditor = useCallback(() => {
    const problems: string[] = [];
    editorRows.forEach((row, index) => {
      const parsed = messageEmbeddedDeclarationSchema.safeParse(declarationOf(row));
      if (!parsed.success) problems.push(`${index + 1} 行目: ${parsed.error.issues.map((issue) => issue.message).join(" / ")}`);
    });
    const checked = checkEmbeddedCatalog([
      ...baseCatalog,
      ...editorRows.map((row) => ({ key: row.key.trim(), alias: row.alias.trim(), source: "own" as const })),
    ]);
    for (const problem of checked) problems.push(problem.message);
    if (problems.length > 0) {
      setEditorErrors(problems);
      return false;
    }
    setEmbedded(editorRows);
    setEditorErrors([]);
    setEditorOpen(false);
    return true;
  }, [editorRows, baseCatalog]);

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
  const publishMutation = useDomainMutation<AdminTemplateDetail, string>(
    `${MESSAGE_TEMPLATES_KEY}/${id ?? "new"}/publish`,
    (targetId) => publishMessageTemplate(targetId),
    [MESSAGE_TEMPLATES_KEY],
  );
  const archiveMutation = useDomainMutation<AdminTemplateDetail, void>(
    `${MESSAGE_TEMPLATES_KEY}/${id ?? "new"}/archive`,
    () => archiveMessageTemplate(id!),
    revalidateKeys,
  );

  /** 送る入力(作る・直すで同じ。鍵はサーバーが作る) */
  const buildInput = useCallback(
    (): CreateMessageTemplateInput => ({
      name: name.trim(),
      description: description.trim() === "" ? null : description,
      category,
      layout,
      values,
      embedded: embedded.map(declarationOf),
    }),
    [name, description, category, layout, values, embedded],
  );

  const initialJson = useMemo(
    () =>
      JSON.stringify({
        name: template?.name ?? "",
        description: template?.description ?? null,
        category: template?.category ?? autoCategoryOf(categories, initialKind),
        layout: template?.layout ?? (options?.layouts.length === 1 ? options.layouts[0].key : ""),
        values: compactLayoutValues(template?.values ?? {}),
        embedded: draftsOf(template?.embedded).map(declarationOf),
      }),
    // 開いた時の値(template・options が替わる時はモーダルが formKey で作り直す)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [template, options],
  );
  const dirty = !readOnly && createdId === null && JSON.stringify(buildInput()) !== initialJson;
  useUnsavedGuard(dirty);

  /** 保存の前の検査(画面で止める物。中身の深い検査はサーバー) */
  const validate = useCallback((): string | null => {
    if (!name.trim()) return "名前を入力してください";
    if (!category) return "カテゴリーを選んでください";
    if (!layoutOption) return "ひな形を選んでください";
    const parsed = layoutValuesSchema({ fields: layoutOption.fields } as MessageLayout, { channels }).safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        valuesForm.form.setError((path || String(issue.path[0] ?? "")) as never, { type: "validate", message: issue.message });
      }
      return "入力を確かめてください";
    }
    if (unknownNames.length > 0) return `使えない埋め込み情報があります: ${unknownNames.join("、")}`;
    return null;
  }, [name, category, layoutOption, channels, values, valuesForm.form, unknownNames]);

  /** 保存 = 作る or 直す → 公開(新しい版、D113)。ボタンが Promise の間 loading */
  const save = useCallback(async () => {
    if (readOnly) return;
    valuesForm.form.clearErrors();
    const problem = validate();
    if (problem) {
      showToast(problem, "error");
      return;
    }
    try {
      const saved = id ? await updateMutation.trigger(buildInput()) : await createMutation.trigger(buildInput());
      if (!id) {
        setCreatedId(saved.id);
        onCreated?.(saved.id);
      }
      try {
        const published = await publishMutation.trigger(saved.id);
        onChanged?.(published, id ? "publish" : "create");
        showToast("保存しました(新しいバージョン)", "success");
      } catch (e) {
        // 前の版と同じ中身(409)= 新しい版は要らない
        if ((e as { status?: number }).status === 409) {
          onChanged?.(saved, id ? "update" : "create");
          showToast("変更はありません", "info");
          return;
        }
        throw e;
      }
    } catch (e) {
      showToast(err(e, "保存できませんでした"), "error");
    }
  }, [readOnly, validate, id, updateMutation, createMutation, publishMutation, buildInput, showToast, onCreated, onChanged, valuesForm.form]);

  /** アーカイブ */
  const archive = useCallback(async () => {
    if (!id || system) return;
    try {
      const result = await archiveMutation.trigger();
      onChanged?.(result, "archive");
      showToast("アーカイブしました", "success");
    } catch (e) {
      showToast(err(e, "アーカイブできませんでした"), "error");
    }
  }, [id, system, archiveMutation, showToast, onChanged]);

  return {
    mode: id ? ("edit" as const) : ("create" as const),
    archived,
    system,
    readOnly,
    dirty,
    createdId,
    save,
    archive,
    /** モーダルを閉じる前の確かめ(Modal の confirmOnClose に渡す) */
    closeConfirm: { enabled: dirty, message: "保存していない変更があります。閉じてもよろしいですか？" },
    fields: {
      name,
      setName,
      description,
      setDescription,
      kind,
      setKind,
      kindOptions,
      category,
      setCategory,
      /** 種類の選択肢(その種別に 2 つ以上ある時だけ画面に出す) */
      categoryChoices,
      showCategory: categoryChoices.length > 1,
      layout,
      layoutOptions: (options?.layouts ?? []).map((item) => ({ value: item.key, label: item.label, description: item.description })),
      layoutLabel: layoutOption?.label ?? null,
      requestLayoutChange,
      /** 替える先(確かめの間だけ) */
      pendingLayout,
      confirmLayoutChange,
      cancelLayoutChange,
      /** 送る経路(種類の経路) */
      channels,
    },
    /** 中身のフォーム(部品 LayoutFields に control と fields) */
    valuesForm,
    /** 今の中身(空の欄を落とした物。プレビューに渡す) */
    values,
    layoutFields: layoutOption?.fields ?? null,
    /** 埋め込み情報の一覧と知らない名前 */
    catalog,
    unknownNames,
    embeddedEditor: {
      open: editorOpen,
      setOpen: setEditorOpen,
      openEditor,
      rows: editorRows,
      updateRow,
      addRow,
      removeRow,
      apply: applyEditor,
      errors: editorErrors,
      /** 宣言した専用の数 */
      count: embedded.length,
    },
  };
}
