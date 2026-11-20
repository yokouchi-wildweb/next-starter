// src/lib/formSuite/FormActions/index.tsx

"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";

import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { useAppFormError } from "../AppForm";
import { Block } from "@/components/Layout/Block";
import { Span } from "@/components/TextBlocks/Span";

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
    <Stack gap="md">
      {showError && <FormErrorMessage />}
      <Flex justify="center" gap="md" className={className}>
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
    <Block className="flex items-center justify-center gap-1.5 text-sm text-destructive-text">
      <AlertCircle className="size-4 shrink-0" />
      <Span inline>入力内容にエラーがあります</Span>
      {displayMode === "detailed" && fieldErrors.length > 0 && (
        <Span inline className="text-muted-foreground">
          （{fieldErrors.map(([, error]) =>
            typeof error?.message === "string" ? error.message : "入力エラー"
          ).join("、")}）
        </Span>
      )}
    </Block>
  );
}
