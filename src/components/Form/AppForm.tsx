// src/components/Form/AppForm.tsx

"use client";

import * as React from "react";
import type {
  FieldValues,
  SubmitErrorHandler,
  SubmitHandler,
  UseFormReturn,
} from "react-hook-form";
import { FormProvider } from "react-hook-form";

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
  children: React.ReactNode;
} & Omit<React.FormHTMLAttributes<HTMLFormElement>, "onSubmit">;

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
    children,
    className,
    onKeyDown,
    ...formProps
  }: AppFormProps<TFieldValues>,
  ref: React.ForwardedRef<HTMLFormElement>,
) => {
  const { handleSubmit, formState } = methods;
  const isSubmitting = formState.isSubmitting;
  const isBusy = pending || isSubmitting;

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

  return (
    <FormProvider {...methods}>
      <form
        ref={ref}
        className={className}
        data-submitting={isBusy ? "true" : "false"}
        aria-busy={isBusy}
        onSubmit={handleSubmit(onSubmit, onSubmitError)}
        onKeyDown={handleKeyDown}
        {...formProps}
      >
        {disableWhilePending ? (
          <fieldset disabled={isBusy} className="contents space-y-4">
            {children}
          </fieldset>
        ) : (
          children
        )}
      </form>
    </FormProvider>
  );
};

export const AppForm = React.forwardRef(AppFormComponent) as <
  TFieldValues extends FieldValues,
>(
  props: AppFormProps<TFieldValues> & { ref?: React.Ref<HTMLFormElement> },
) => React.ReactElement;
