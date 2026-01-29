// src/components/Form/FormActions/index.tsx

"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";

import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { useAppFormError } from "@/components/Form/AppForm";

type FormActionsProps = {
  children: React.ReactNode;
  /** 追加のクラス名 */
  className?: string;
};

/**
 * フォームのアクションボタン群をラップするコンポーネント
 * AppForm内で使用すると、バリデーションエラー時にエラーメッセージを自動表示
 *
 * @example
 * <FormActions>
 *   <Button type="submit">登録</Button>
 * </FormActions>
 */
export function FormActions({ children, className }: FormActionsProps) {
  const errorContext = useAppFormError();

  // none / toast の場合はインライン表示しない
  const showError =
    errorContext &&
    errorContext.hasErrors &&
    errorContext.displayMode !== "none" &&
    errorContext.displayMode !== "toast";

  return (
    <Stack space={4}>
      {showError && <FormErrorMessage />}
      <Flex justify="center" gap="sm" className={className}>
        {children}
      </Flex>
    </Stack>
  );
}

/**
 * フォームエラーメッセージを表示する内部コンポーネント
 */
function FormErrorMessage() {
  const errorContext = useAppFormError();

  if (
    !errorContext ||
    !errorContext.hasErrors ||
    errorContext.displayMode === "none" ||
    errorContext.displayMode === "toast"
  ) {
    return null;
  }

  const { displayMode, errors } = errorContext;

  // rootエラー以外のフィールドエラーを取得
  const fieldErrors = Object.entries(errors).filter(([key]) => key !== "root");

  return (
    <div className="flex items-center justify-center gap-1.5 text-sm text-destructive">
      <AlertCircle className="size-4 shrink-0" />
      <span>入力内容にエラーがあります</span>
      {displayMode === "detailed" && fieldErrors.length > 0 && (
        <span className="text-muted-foreground">
          （{fieldErrors.map(([, error]) =>
            typeof error?.message === "string" ? error.message : "入力エラー"
          ).join("、")}）
        </span>
      )}
    </div>
  );
}
