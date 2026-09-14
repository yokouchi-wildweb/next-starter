// src/features/core/auth/components/Registration/InviteCodeField.tsx
//
// サインアップフォームの招待コード欄（Email / OAuth 共用）。
// 購入ページのクーポン欄（wallet CouponInput）と同じ操作モデル:
// - 入力状態: 入力欄 + 「適用」ボタン（Enter でも適用）。失敗は赤文字
// - 適用済み: 緑の枠にコードと「有効な招待コードです」+「取り消す」
// 検証ロジックは useInviteCodeValidation が持ち、この部品は表示のみ。

"use client";

import type { Control, FieldValues, Path } from "react-hook-form";

import { ControlledField } from "@/components/Form";
import { Button } from "@/components/Form/Button/Button";
import { TextInput } from "@/components/Form/Input/Controlled";
import { Flex, Stack } from "@/components/Layout";
import { Spinner } from "@/components/Overlays/Loading/Spinner";
import { Span } from "@/components/TextBlocks";
import type { InviteCodeApplyState } from "@/features/core/auth/hooks/useInviteCodeValidation";
import { INVITE_CODE_APPLIED_MESSAGE } from "@/features/core/referral/constants/inviteCodeValidation";

type InviteCodeFieldProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues>;
  state: InviteCodeApplyState;
  name?: Path<TFieldValues>;
};

export function InviteCodeField<TFieldValues extends FieldValues>({
  control,
  state,
  name = "inviteCode" as Path<TFieldValues>,
}: InviteCodeFieldProps<TFieldValues>) {
  const { appliedCode, isLoading, errorMessage, apply, clear, onDraftChange } = state;

  // 適用済み状態
  if (appliedCode) {
    return (
      <Stack space={2}>
        <Flex justify="between" align="center">
          <Span size="sm" weight="medium">招待コード</Span>
          <Button type="button" variant="ghost" size="xxs" onClick={clear}>
            取り消す
          </Button>
        </Flex>
        <Flex
          justify="between"
          align="center"
          className="rounded-lg border border-green-200 bg-green-50 px-3 py-2"
        >
          <Span size="sm" weight="medium">{appliedCode}</Span>
          <Span size="sm" tone="success" weight="bold">{INVITE_CODE_APPLIED_MESSAGE}</Span>
        </Flex>
      </Stack>
    );
  }

  // 入力状態
  return (
    <ControlledField
      control={control}
      name={name}
      label="招待コード"
      description={errorMessage ? { text: errorMessage, tone: "danger", size: "sm" } : undefined}
      renderInput={(field) => (
        <Flex gap="sm">
          <TextInput
            field={field}
            placeholder="お持ちの場合は入力してください"
            autoComplete="off"
            spellCheck={false}
            disabled={isLoading}
            className="flex-1"
            onChange={(e) => {
              field.onChange(e);
              onDraftChange();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void apply(field.value ?? "");
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={() => void apply(field.value ?? "")}
            disabled={isLoading || !(field.value ?? "").trim()}
          >
            {isLoading ? <Spinner className="h-4 w-4" /> : "適用"}
          </Button>
        </Flex>
      )}
    />
  );
}
