"use client";

// src/features/core/messaging/hooks/useMessageTemplateForm.ts
//
// 管理: テンプレートを作る・直す画面の書く欄と操作(部品はこれを呼んで描くだけ。CLAUDE.md core_ui_guards)。
// - 順 = 種別 → カテゴリー(種別を選ぶと最初の物を自動で選ぶ。1 つでも出す、D118)→ ひな形(管理者が選べる物)→ 中身(D115)。新しく作る時は種別を先に選ばない(D110)
// - 中身 = ひな形の欄(useLayoutFieldsForm)。経路は種類が決め、経路だけの欄とプレビューのタブはその分(D115)
// - ひな形を替える: 中身があれば確かめてから消す(pendingLayout → confirmLayoutChange、D113)。中身の付け替えはしない
// - 保存 = 作る(POST)か直す(PATCH)の 1 回で公開(作る = 版 1、直す = 中身が違えば新しい版、D134)。同じ中身なら unchanged →「変更はありません」。名前・説明・種類・ひな形・中身・専用の埋め込み情報
// - 専用の埋め込み情報 = 『専用の埋め込み情報を管理』のモーダルで足す・直す(embeddedEditor。適用で検査を通った物だけ反映、D126)
// - 埋め込み情報のタグ = 選択肢の baseCatalog(共通 + enrichers)+ 専用。中身の中の知らない {{名前}} を返す
// - システムテンプレート(system)は読むだけ(保存しない、D117)。削除 = remove(版も消え、送った回は残る、D137。成功で true)
// - 中身の入力と埋め込み情報は fieldsReady(ひな形・種別・カテゴリーがそろい、カテゴリーに経路が 1 つ以上)まで出さない。
//   それまでは fieldsHint(先に選ぶ物の 1 行、D139)
// - 書きかけがある間は離れる前に確かめる(@/lib/unsavedGuard。モーダルを閉じる前の確かめは closeConfirm)
// - 作った後は onCreated(id) を呼ぶ(モーダルがその 1 件を直す形に変わる。ページは移らない)

import { useCallback, useMemo, useState } from "react";
import { useWatch } from "react-hook-form";
import { useSWRConfig } from "swr";

import { useDomainMutation } from "@/lib/crud";
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
import { listVariables } from "@/lib/templateVariables";
import { useToast } from "@/lib/toast";
import { useUnsavedGuard } from "@/lib/unsavedGuard";

import { MESSAGE_KIND_LABELS } from "../constants/kindLabels";
import {
  deleteMessageTemplate,
  createMessageTemplate,
  updateMessageTemplate,
  type AdminTemplateDetail,
  type AdminTemplateSaveResult,
  type AdminTemplateOptions,
  type CreateMessageTemplateInput,
} from "../services/client/templateClient";

import { layoutFieldsDefaults, useLayoutFieldsForm } from "./useLayoutFieldsForm";
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
export type MessageTemplateAction = "create" | "update" | "publish" | "delete";

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

/**
 * 並びに依らない JSON(object の鍵を並べ替えて文字にする)。書きかけの判定に使う:
 * DB の jsonb は鍵を長さと字の順に並べ直し、フォームは欄の宣言の順に組むので、そのままの JSON.stringify は同じ中身でも違う(J142)
 */
export function canonicalJson(value: unknown): string {
  const sort = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(sort);
    if (item && typeof item === "object") {
      return Object.fromEntries(
        Object.keys(item as Record<string, unknown>)
          .sort()
          .map((key) => [key, sort((item as Record<string, unknown>)[key])]),
      );
    }
    return item;
  };
  return JSON.stringify(sort(value));
}

/** 中身の文字を全部集める({{名前}} を探すため) */
function stringsOf(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const item of value) stringsOf(item, out);
  else if (value && typeof value === "object") for (const item of Object.values(value)) stringsOf(item, out);
  return out;
}

/** 種別の最初のカテゴリー(種別を選んだ時に自動で選ぶ、D118)。種別が空・カテゴリーが無ければ空 */
function firstCategoryOf(categories: readonly { key: string; kind: string }[], kind: string): string {
  return categories.find((category) => category.kind === kind)?.key ?? "";
}

/** 新しい宣言の行 */
export function emptyEmbeddedDraft(): EmbeddedDeclarationDraft {
  return { key: "", alias: "", type: "line", required: false, default: "", options: [] };
}

export function useMessageTemplateForm({ template, options, onCreated, onChanged }: UseMessageTemplateFormOptions) {
  const { showToast } = useToast();
  const { mutate } = useSWRConfig();
  const id = template?.id ?? null;
  const system = Boolean(template?.system);
  const readOnly = system;

  const categories = useMemo(() => options?.categories ?? [], [options]);
  /** 種別の選択肢(種類のある物だけ、lib の並び) */
  const kindOptions = useMemo(
    () =>
      MESSAGE_KINDS.filter((kind) => (TEMPLATE_KINDS as readonly string[]).includes(kind) && categories.some((category) => category.kind === kind)).map(
        (kind) => ({ value: kind, label: MESSAGE_KIND_LABELS[kind] }),
      ),
    [categories],
  );
  // 新しく作る時は種別を選ばせる(先に選んでおかない、D110 D118)。直す時は保存した種別
  const initialKind = categories.find((category) => category.key === template?.category)?.kind ?? template?.kind ?? "";

  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [kind, setKindState] = useState(initialKind);
  const [category, setCategory] = useState(template?.category || firstCategoryOf(categories, initialKind));
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
      // 種別を替えたらその種別の最初のカテゴリーを選び直す(D118)
      setCategory(firstCategoryOf(categories, next));
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
  const updateMutation = useDomainMutation<AdminTemplateSaveResult, CreateMessageTemplateInput>(
    `${MESSAGE_TEMPLATES_KEY}/${id ?? "new"}/update`,
    (input) => updateMessageTemplate(id!, input),
    revalidateKeys,
  );
  // 消した 1 件・版は取り直さない(404 になる。モーダルは閉じる)。一覧だけ
  const deleteMutation = useDomainMutation<{ id: string; deleted: true }, void>(
    `${MESSAGE_TEMPLATES_KEY}/${id ?? "new"}/delete`,
    () => deleteMessageTemplate(id!),
    [MESSAGE_TEMPLATES_KEY],
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

  // 書きかけの判定の元 = 開いた時の値をフォームと同じ道で組んだ物(欄の宣言に無い鍵は落とし、空の欄の形も同じ)
  const initialJson = useMemo(
    () =>
      canonicalJson({
        // 名前・説明も buildInput と同じ整え方(前後の空白・空の説明 = null)
        name: (template?.name ?? "").trim(),
        description: (template?.description ?? "").trim() === "" ? null : template?.description,
        category: template?.category || firstCategoryOf(categories, initialKind),
        layout: template?.layout ?? (options?.layouts.length === 1 ? options.layouts[0].key : ""),
        values: compactLayoutValues(
          layoutFieldsDefaults(options?.layouts.find((item) => item.key === template?.layout)?.fields ?? {}, template?.values ?? null),
        ),
        embedded: draftsOf(template?.embedded).map(declarationOf),
      }),
    // 開いた時の値(template・options が替わる時はモーダルが formKey で作り直す)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [template, options],
  );
  const dirty = !readOnly && createdId === null && canonicalJson(buildInput()) !== initialJson;
  useUnsavedGuard(dirty);

  /** 保存の前の検査(画面で止める物。中身の深い検査はサーバー) */
  const validate = useCallback((): string | null => {
    if (!name.trim()) return "名前を入力してください";
    if (!kind) return "種別を選んでください";
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
  }, [name, kind, category, layoutOption, channels, values, valuesForm.form, unknownNames]);

  /** 保存 = 作る or 直す の 1 回で公開(D134)。ボタンが Promise の間 loading */
  const save = useCallback(async () => {
    if (readOnly) return;
    valuesForm.form.clearErrors();
    const problem = validate();
    if (problem) {
      showToast(problem, "error");
      return;
    }
    try {
      // 保存 = 公開(作る = 版 1、直す = 中身が違えば新しい版。同じなら unchanged、D134)
      const saved = id ? await updateMutation.trigger(buildInput()) : await createMutation.trigger(buildInput());
      if (!id) setCreatedId(saved.id);
      // 1 件の SWR のキーは文字の完全一致なので、一覧のキーの取り直しでは届かない。返った 1 件をキャッシュに書き、版の一覧を取り直す
      // (1 件の更新時刻・版が変わる → モーダルが formKey で書く欄を作り直す = 保存の後は書きかけ無し、F4 F5)
      const unchanged = id ? (saved as AdminTemplateSaveResult).unchanged : false;
      const detail: AdminTemplateDetail = saved;
      await mutate(messageTemplateKey(detail.id), detail, { revalidate: false });
      await mutate(messageTemplateVersionsKey(detail.id));
      // 作った時はキャッシュを書いた後にモーダルを直す形へ
      if (!id) onCreated?.(detail.id);
      onChanged?.(detail, id ? (unchanged ? "update" : "publish") : "create");
      showToast(unchanged ? "変更はありません" : "保存しました(新しいバージョン)", unchanged ? "info" : "success");
    } catch (e) {
      showToast(err(e, "保存できませんでした"), "error");
    }
  }, [readOnly, validate, id, updateMutation, createMutation, buildInput, showToast, onCreated, onChanged, valuesForm.form, mutate]);

  /** 削除(版も消え、送った回は残る、D137)。消せたら true(呼び手がモーダルを閉じる) */
  const remove = useCallback(async (): Promise<boolean> => {
    if (!id || system || !template) return false;
    try {
      await deleteMutation.trigger();
      onChanged?.(template, "delete");
      showToast("削除しました", "success");
      return true;
    } catch (e) {
      showToast(err(e, "削除できませんでした"), "error");
      return false;
    }
  }, [id, system, template, deleteMutation, showToast, onChanged]);

  // 中身の入力を出せるか(D139): ひな形・種別・カテゴリーがそろい、カテゴリーに経路が 1 つ以上
  const missing = [!kind ? "種別" : null, !category ? "カテゴリー" : null, !layoutOption ? "ひな形" : null].filter((item): item is string => item !== null);
  const fieldsReady = missing.length === 0 && channels.length > 0;
  const fieldsHint = fieldsReady
    ? null
    : missing.length > 0
      ? `${missing.join("・")}を選ぶと入力欄が出ます`
      : "このカテゴリーには送信方法がありません。別のカテゴリーを選んでください";

  return {
    mode: id ? ("edit" as const) : ("create" as const),
    /** 中身の入力と埋め込み情報を出せるか(D139) */
    fieldsReady,
    /** 出せない時の 1 行(先に選ぶ物) */
    fieldsHint,
    system,
    readOnly,
    dirty,
    createdId,
    save,
    remove,
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
      /** カテゴリーの選択肢(選んだ種別の物。種別を選ぶまで空、D118) */
      categoryChoices,
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
