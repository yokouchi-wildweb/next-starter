// src/features/core/auth/components/PhoneVerification/PhoneNumberStep.tsx

"use client";

import { useState, type FormEvent } from "react";
import { Phone } from "lucide-react";

import { Button } from "@/components/Form/Button/Button";
import { Label } from "@/components/Form/Label";
import { Input } from "@/components/Form/Input/Manual";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import type { PhoneVerificationMode } from "@/features/core/auth/hooks/usePhoneVerification";

export type PhoneNumberStepProps = {
  phoneNumber: string;
  isLoading: boolean;
  error: Error | null;
  onPhoneNumberChange: (phoneNumber: string) => void;
  onSubmit: () => Promise<void>;
  onCancel?: () => void;
  /** 認証モード: "register" = 新規登録, "change" = 番号変更 */
  mode?: PhoneVerificationMode;
  /** 変更モード時の現在の電話番号 */
  currentPhoneNumber?: string | null;
};

export function PhoneNumberStep({
  phoneNumber,
  isLoading,
  error,
  onPhoneNumberChange,
  onSubmit,
  onCancel,
  mode = "register",
  currentPhoneNumber,
}: PhoneNumberStepProps) {
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError(null);

    if (isLoading || !phoneNumber.trim()) return;

    try {
      await onSubmit();
    } catch {
      // エラーはフック側で管理される
    }
  };

  const displayError = error?.message || localError;

  const isChangeMode = mode === "change";

  return (
    <section id="phone-verification-input" className="w-full">
      <Stack space={6}>
        <Stack space={2}>
          <h2 className="text-xl font-semibold">
            {isChangeMode ? "電話番号の変更" : "電話番号認証"}
          </h2>
          <Para size="sm" className="text-muted-foreground">
            {isChangeMode
              ? "新しい電話番号にSMSで認証コードを送信します。"
              : "SMSで認証コードを送信します。電話番号を入力してください。"}
          </Para>
        </Stack>

        {isChangeMode && currentPhoneNumber && (
          <Stack space={1}>
            <Para size="sm" className="font-medium text-foreground">
              現在の電話番号
            </Para>
            <Para size="sm" className="text-muted-foreground">
              {currentPhoneNumber}
            </Para>
          </Stack>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <Stack space={2}>
            <Label htmlFor="phone-number" className="block text-foreground">
              {isChangeMode ? "新しい電話番号" : "電話番号"}
            </Label>
            <Input
              id="phone-number"
              type="tel"
              autoComplete="tel"
              required
              value={phoneNumber}
              onChange={(event) => onPhoneNumberChange(event.target.value)}
              leftIcon={<Phone className="size-4" />}
              placeholder="例）09012345678"
              disabled={isLoading}
            />
            <Para size="xs" className="text-muted-foreground">
              ハイフンなしで入力してください
            </Para>
          </Stack>

          {displayError && (
            <Para tone="error" size="sm">
              {displayError}
            </Para>
          )}

          <Stack space={3}>
            <Button
              type="submit"
              disabled={isLoading || !phoneNumber.trim()}
              className="w-full"
            >
              {isLoading ? "送信中..." : "認証コードを送信"}
            </Button>

            {onCancel && (
              <Button
                type="button"
                variant="ghost"
                onClick={onCancel}
                disabled={isLoading}
                className="w-full"
              >
                キャンセル
              </Button>
            )}
          </Stack>
        </form>
      </Stack>
    </section>
  );
}
