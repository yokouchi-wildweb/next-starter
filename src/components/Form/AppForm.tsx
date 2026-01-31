// src/components/Form/AppForm.tsx

"use client";

import * as React from "react";
import type {
  FieldValues,
  FieldErrors,
  SubmitErrorHandler,
  SubmitHandler,
  UseFormReturn,
} from "react-hook-form";
import { FormProvider } from "react-hook-form";

import { Stack, type StackSpace } from "@/components/Layout/Stack";
import type { MediaState, MediaHandleEntry } from "@/components/Form/FieldRenderer/types";
import { useToast } from "@/lib/toast";
import { cn } from "@/lib/cn";
import { AutoSaveContext, useAutoSave, type AutoSaveOptions } from "./AutoSave";

/**
 * 送信ボタン付近のエラー表示モード
 * - 'none': 表示しない
 * - 'toast': トーストでサマリー表示
 * - 'summary': インラインでサマリー表示
 * - 'detailed': インラインで詳細表示
 */
export type SubmitErrorDisplay = "none" | "toast" | "summary" | "detailed";

// エラー表示用のContext
type AppFormErrorContextValue = {
  /** エラー表示モード */
  displayMode: SubmitErrorDisplay;
  /** フォームのエラー状態 */
  errors: FieldErrors;
  /** エラーがあるか */
  hasErrors: boolean;
};

const AppFormErrorContext = React.createContext<AppFormErrorContextValue | null>(null);

/**
 * AppForm内でエラー状態を取得するためのフック
 * Button コンポーネントから使用
 */
export function useAppFormError() {
  return React.useContext(AppFormErrorContext);
}

// MediaState管理用のContext
type AppFormMediaContextValue = {
  /** FieldRenderer用: MediaState全体を設定（後方互換性のため残存） */
  setMediaState: (state: MediaState | null) => void;
  /** 個別メディアフィールド用: ハンドルを登録 */
  registerMediaHandle: (name: string, entry: MediaHandleEntry) => void;
  /** 個別メディアフィールド用: ハンドルを解除 */
  unregisterMediaHandle: (name: string) => void;
  /** メディアアップロード中かどうか */
  isMediaUploading: boolean;
};

const AppFormMediaContext = React.createContext<AppFormMediaContextValue | null>(null);

/**
 * AppForm内でMediaStateを設定するためのフック
 * ConfiguredMediaField, MediaFieldItem, FieldRenderer から使用
 */
export function useAppFormMedia() {
  const context = React.useContext(AppFormMediaContext);
  return context;
}

type AllowEnterWhen = (event: React.KeyboardEvent<HTMLFormElement>) => boolean;

export type AppFormProps<TFieldValues extends FieldValues = FieldValues> = {
  methods: UseFormReturn<TFieldValues>;
  onSubmit: SubmitHandler<TFieldValues>;
  onSubmitError?: SubmitErrorHandler<TFieldValues>;
  preventSubmitOnEnter?: boolean;
  allowEnterSelectors?: string[];
  allowEnterWhen?: AllowEnterWhen;
  pending?: boolean;
  disableWhilePending?: boolean;
  fieldSpace?: StackSpace;
  children: React.ReactNode;
  /**
   * メディアアップロード状態（外部から渡す場合）
   * 通常は内部で自動管理されるため不要
   */
  mediaState?: MediaState | null;
  /**
   * メディアアップロード状態の変更コールバック
   * FieldRendererのonMediaStateChangeに渡す用（通常は不要、内部で自動連携）
   */
  onMediaStateChange?: (state: MediaState | null) => void;
  /**
   * メディアの自動コミットを無効化するかどうか
   * デフォルト: false（自動コミット有効）
   */
  disableAutoCommitMedia?: boolean;
  /**
   * 送信ボタン付近のエラー表示モード
   * - false: 表示しない
   * - 'summary': 「入力内容にエラーがあります」（デフォルト）
   * - 'detailed': 各フィールドのエラーを列挙
   * @default 'summary'
   */
  submitErrorDisplay?: SubmitErrorDisplay;
  /**
   * 自動保存オプション
   * 指定しない場合は従来型の保存モード（明示的なsubmitボタンクリック時のみ保存）
   *
   * @example
   * ```tsx
   * <AppForm
   *   methods={methods}
   *   onSubmit={handleSubmit}
   *   autoSave={{
   *     enabled: true,
   *     onSave: async (data) => await updateItem(id, data),
   *     debounceMs: 500,
   *   }}
   * >
   * ```
   */
  autoSave?: AutoSaveOptions<TFieldValues>;
} & Omit<React.FormHTMLAttributes<HTMLFormElement>, "onSubmit" | "autoSave">;

const AppFormComponent = <TFieldValues extends FieldValues>(
  {
    methods,
    onSubmit,
    onSubmitError,
    preventSubmitOnEnter = true,
    allowEnterSelectors = [],
    allowEnterWhen,
    pending = false,
    disableWhilePending = true,
    fieldSpace = 6,
    children,
    className,
    onKeyDown,
    mediaState: externalMediaState,
    onMediaStateChange,
    disableAutoCommitMedia = false,
    submitErrorDisplay = "summary",
    autoSave,
    ...formProps
  }: AppFormProps<TFieldValues>,
  ref: React.ForwardedRef<HTMLFormElement>,
) => {
  const { handleSubmit, formState } = methods;
  const isSubmitting = formState.isSubmitting;
  const { errors } = formState;
  const { showToast } = useToast();

  // 自動保存
  const { contextValue: autoSaveContextValue, isSaving } = useAutoSave({
    methods,
    options: autoSave,
  });

  // rootエラー以外のフィールドエラーがあるか判定
  const hasFieldErrors = Object.keys(errors).some((key) => key !== "root");

  // 前回のsubmitCount（送信回数）を追跡してトースト表示タイミングを制御
  const prevSubmitCountRef = React.useRef(formState.submitCount);

  // toastモードの場合、送信時にエラーがあればトーストを表示
  React.useEffect(() => {
    if (submitErrorDisplay !== "toast") return;
    if (formState.submitCount === prevSubmitCountRef.current) return;

    prevSubmitCountRef.current = formState.submitCount;

    if (hasFieldErrors) {
      showToast("入力内容にエラーがあります", "error");
    }
  }, [submitErrorDisplay, formState.submitCount, hasFieldErrors, showToast]);

  // 個別メディアフィールドのハンドル管理
  const mediaHandlesRef = React.useRef<Map<string, MediaHandleEntry>>(new Map());
  const [mediaHandlesVersion, setMediaHandlesVersion] = React.useState(0);

  const registerMediaHandle = React.useCallback((name: string, entry: MediaHandleEntry) => {
    mediaHandlesRef.current.set(name, entry);
    setMediaHandlesVersion((v) => v + 1);
  }, []);

  const unregisterMediaHandle = React.useCallback((name: string) => {
    mediaHandlesRef.current.delete(name);
    setMediaHandlesVersion((v) => v + 1);
  }, []);

  // FieldRenderer用: MediaState全体を管理（後方互換性）
  const [fieldRendererMediaState, setFieldRendererMediaState] = React.useState<MediaState | null>(null);
  const handleMediaStateChange = React.useCallback(
    (state: MediaState | null) => {
      setFieldRendererMediaState(state);
      onMediaStateChange?.(state);
    },
    [onMediaStateChange],
  );

  // 外部から渡された mediaState を優先
  const effectiveFieldRendererState = externalMediaState ?? fieldRendererMediaState;

  // 個別登録されたメディアのアップロード状態を計算
  const individualMediaUploading = React.useMemo(() => {
    const entries = Array.from(mediaHandlesRef.current.values());
    return entries.some((entry) => entry.isUploading);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaHandlesVersion]);

  // メディアアップロード中はフォームを無効化（両方を考慮）
  const isMediaUploading = (effectiveFieldRendererState?.isUploading ?? false) || individualMediaUploading;
  // NOTE: isSavingは含めない（自動保存中も編集を継続できるようにする）
  // autoSave有効時は、isSaving中のpendingも除外（同じtriggerを使うためisMutatingがtrueになるが、編集は継続させる）
  const effectivePending = isSaving ? false : pending;
  const isBusy = effectivePending || isSubmitting || isMediaUploading;

  // 送信成功時にメディアをコミット
  const handleSubmitWithMediaCommit: SubmitHandler<TFieldValues> = React.useCallback(
    async (data, event) => {
      await onSubmit(data, event);

      if (disableAutoCommitMedia) return;

      // FieldRenderer経由のメディアをコミット
      if (effectiveFieldRendererState) {
        await effectiveFieldRendererState.commitAll();
      }

      // 個別登録されたメディアをコミット
      const individualEntries = Array.from(mediaHandlesRef.current.values());
      if (individualEntries.length > 0) {
        await Promise.all(individualEntries.map((entry) => entry.commit()));
      }
    },
    [onSubmit, disableAutoCommitMedia, effectiveFieldRendererState],
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLFormElement>) => {
      onKeyDown?.(event);

      // Enter送信抑止を無効化した場合や既に他の処理でキャンセルされた場合は何もしない
      if (!preventSubmitOnEnter || event.defaultPrevented || event.key !== "Enter") {
        return;
      }

      // IME変換確定中のEnterは送信抑止しない
      if ((event as unknown as { isComposing?: boolean }).isComposing) {
        return;
      }

      const target = event.target as HTMLElement | null;

      // 対象要素が取得できない場合は処理しない
      if (!target) {
        return;
      }

      // textareaでは改行目的のEnter入力を許可する
      if (target.tagName === "TEXTAREA") {
        return;
      }

      // ボタン上でのEnterは既存のボタン動作に委ねる
      if (target.tagName === "BUTTON") {
        return;
      }

      // contenteditable要素は自由入力領域として扱いEnterを許可する
      if (target.getAttribute("contenteditable") === "true") {
        return;
      }

      // input要素の場合はtype属性ごとに判定を分岐する
      if (target instanceof HTMLInputElement) {
        const type = target.type.toLowerCase();

        // submit / buttonタイプのinputではデフォルト動作を優先する
        if (type === "submit" || type === "button") {
          return;
        }
      }

      const role = target.getAttribute("role");

      // ARIAロールでtextboxやcomboboxが指定されている場合はEnterを許可する
      if (role && ["textbox", "combobox"].includes(role)) {
        return;
      }

      // data-allow-enter属性が付与されている祖先要素内ではEnter送信を許可する
      if (target.closest("[data-allow-enter]")) {
        return;
      }

      // allowEnterSelectorsで指定された要素内ではEnter送信を許可する
      if (allowEnterSelectors.some((selector) => target.closest(selector))) {
        return;
      }

      // allowEnterWhenのコールバックがtrueを返した場合はEnter送信を許可する
      if (allowEnterWhen?.(event)) {
        return;
      }

      event.preventDefault();
    },
    [allowEnterSelectors, allowEnterWhen, onKeyDown, preventSubmitOnEnter],
  );

  // Context用の値
  const mediaContextValue = React.useMemo<AppFormMediaContextValue>(
    () => ({
      setMediaState: handleMediaStateChange,
      registerMediaHandle,
      unregisterMediaHandle,
      isMediaUploading,
    }),
    [handleMediaStateChange, registerMediaHandle, unregisterMediaHandle, isMediaUploading],
  );

  // エラー表示用Context
  const errorContextValue = React.useMemo<AppFormErrorContextValue>(
    () => ({
      displayMode: submitErrorDisplay,
      errors,
      hasErrors: hasFieldErrors,
    }),
    [submitErrorDisplay, errors, hasFieldErrors],
  );

  return (
    <FormProvider {...methods}>
      <AutoSaveContext.Provider value={autoSaveContextValue}>
        <AppFormErrorContext.Provider value={errorContextValue}>
          <AppFormMediaContext.Provider value={mediaContextValue}>
            <form
              ref={ref}
              className={cn(className, isSaving && "cursor-progress")}
              data-submitting={isBusy ? "true" : "false"}
              data-saving={isSaving ? "true" : "false"}
              aria-busy={isBusy || isSaving}
              onSubmit={handleSubmit(handleSubmitWithMediaCommit, onSubmitError)}
              onKeyDown={handleKeyDown}
              {...formProps}
            >
              <fieldset
                disabled={disableWhilePending ? isBusy : undefined}
                className="contents"
              >
                <Stack space={fieldSpace}>{children}</Stack>
              </fieldset>
            </form>
          </AppFormMediaContext.Provider>
        </AppFormErrorContext.Provider>
      </AutoSaveContext.Provider>
    </FormProvider>
  );
};

export const AppForm = React.forwardRef(AppFormComponent) as <
  TFieldValues extends FieldValues,
>(
  props: AppFormProps<TFieldValues> & { ref?: React.Ref<HTMLFormElement> },
) => React.ReactElement;
