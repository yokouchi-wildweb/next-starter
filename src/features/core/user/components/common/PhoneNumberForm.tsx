// src/features/core/user/components/common/PhoneNumberForm.tsx
// 電話番号の入力(SMS 認証なし)の表示の部品。値と処理は useUpdateMyPhoneNumber の返り値を受けて描くだけ

"use client";

import type { FormEvent } from "react";
import { Phone } from "lucide-react";

import { Button } from "@/components/Form/Button/Button";
import { Input } from "@/components/Form/Input/Manual";
import { Label } from "@/components/Form/Label";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { formatForDisplay } from "@/features/core/user/utils/phoneNumber";

export type PhoneNumberFormProps = {
  /** 登録済みの番号(E.164、未登録なら null) */
  currentPhoneNumber: string | null;
  value: string;
  onValueChange: (value: string) => void;
  onSave: () => void | Promise<unknown>;
  /** 登録済みの番号を消す(省略 = 消すボタンを出さない) */
  onClear?: () => void | Promise<unknown>;
  onCancel?: () => void;
  isSaving: boolean;
  error: string | null;
};

export function PhoneNumberForm({
  currentPhoneNumber,
  value,
  onValueChange,
  onSave,
  onClear,
  onCancel,
  isSaving,
  error,
}: PhoneNumberFormProps) {
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving || !value.trim()) return;
    await onSave();
  };

  return (
    <Stack space={6}>
      <Stack space={1}>
        <Para size="sm" className="font-medium text-foreground">
          現在の電話番号
        </Para>
        <Para size="sm" className="text-muted-foreground">
          {currentPhoneNumber ? `${formatForDisplay(currentPhoneNumber)}(未認証)` : "未登録"}
        </Para>
      </Stack>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Stack space={2}>
          <Label htmlFor="phone-number-plain" className="block text-foreground">
            {currentPhoneNumber ? "新しい電話番号" : "電話番号"}
          </Label>
          <Input
            id="phone-number-plain"
            type="tel"
            autoComplete="tel"
            required
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            leftIcon={<Phone className="size-4" />}
            placeholder="例）09012345678"
            disabled={isSaving}
          />
          <Para size="xs" className="text-muted-foreground">
            ハイフンなしで入力してください
          </Para>
        </Stack>

        {error && (
          <Para tone="destructive" size="sm">
            {error}
          </Para>
        )}

        <Stack space={3}>
          <Button type="submit" disabled={isSaving || !value.trim()} className="w-full">
            {isSaving ? "保存中..." : "保存する"}
          </Button>
          {onClear && currentPhoneNumber && (
            <Button type="button" variant="outline" onClick={() => void onClear()} disabled={isSaving} className="w-full">
              電話番号を削除する
            </Button>
          )}
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel} disabled={isSaving} className="w-full">
              戻る
            </Button>
          )}
        </Stack>
      </form>
    </Stack>
  );
}
