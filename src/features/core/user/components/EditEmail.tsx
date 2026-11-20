// src/features/core/user/components/EditEmail.tsx

"use client";

import { useCallback, useState } from "react";
import { useRouter } from "@/lib/unsavedGuard";
import { MailIcon } from "lucide-react";

import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import { Label } from "@/components/Input/Label";
import { Section } from "@/components/Layout/Section";
import { Flex } from "@/components/Layout/Flex";
import { Block } from "@/components/Layout/Block";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { useEmailChange } from "@/features/core/auth/hooks/useEmailChange";

import { AccountPageHeader } from "@/features/core/user/components/common/AccountPageHeader";

type EditEmailProps = {
  currentEmail: string | null;
};

export function EditEmail({ currentEmail }: EditEmailProps) {
  const router = useRouter();
  const { sendVerification, isLoading, error, isSuccess } = useEmailChange();
  const [editEmail, setEditEmail] = useState("");
  const [isChanging, setIsChanging] = useState(false);

  const handleSend = useCallback(async () => {
    const trimmedEmail = editEmail.trim();
    if (!trimmedEmail) return;

    await sendVerification({ newEmail: trimmedEmail });
  }, [editEmail, sendVerification]);

  const goBack = useCallback(() => {
    router.push("/mypage/account");
  }, [router]);

  return (
    <Section>
      <Stack gap="md">
        <AccountPageHeader
          title="メールアドレスを編集"
          backHref="/mypage/account"
          backDisabled={isLoading}
        />
        <Block className="rounded-xl border border-border bg-card p-5 shadow-sm">
          {isSuccess ? (
            <Stack gap="md" className="text-center">
              <Flex justify="center">
                <Flex align="center" justify="center" className="h-12 w-12 rounded-full bg-success/15">
                  <MailIcon className="h-6 w-6 text-success-text" />
                </Flex>
              </Flex>
              <Stack gap="xs">
                <Para size="inherit" weight="medium" align="inherit" className="my-0">確認メールを送信しました</Para>
                <Para size="sm" tone="muted" weight="inherit" align="inherit" className="my-0">
                  {editEmail} 宛に確認メールを送信しました。
                  メール内のリンクをクリックして変更を完了してください。
                </Para>
              </Stack>
              <Button
                type="button"
                variant="outline"
                onClick={goBack}
                className="w-full"
              >
                戻る
              </Button>
            </Stack>
          ) : !isChanging ? (
            <Stack gap="md" className="text-center">
              <Flex justify="center">
                <Flex align="center" justify="center" className="h-12 w-12 rounded-full bg-primary/10">
                  <MailIcon className="h-6 w-6 text-primary" />
                </Flex>
              </Flex>
              <Stack gap="xs">
                <Para size="inherit" weight="medium" align="inherit" className="my-0">現在のメールアドレス</Para>
                <Para size="sm" tone="muted" weight="inherit" align="inherit" className="my-0">
                  {currentEmail ?? "未設定"}
                </Para>
              </Stack>
              <Stack gap="xs">
                <Button
                  type="button"
                  onClick={() => setIsChanging(true)}
                  className="w-full"
                >
                  メールアドレスを変更する
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={goBack}
                  className="w-full"
                >
                  戻る
                </Button>
              </Stack>
            </Stack>
          ) : (
            <Stack gap="md">
              <Block>
                <Label className="mb-2 block text-muted-foreground">
                  現在のメールアドレス
                </Label>
                <Para size="sm" weight="inherit" align="inherit" className="my-0">{currentEmail ?? "未設定"}</Para>
              </Block>
              <Block>
                <Label htmlFor="new-email" className="mb-2 block">
                  新しいメールアドレス
                </Label>
                <Input
                  type="email"
                  id="new-email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="新しいメールアドレスを入力"
                  disabled={isLoading}
                />
              </Block>
              {error && (
                <Para size="sm" tone="destructive" weight="inherit" align="inherit" className="my-0">{error}</Para>
              )}
              <Para size="xs" tone="muted" weight="inherit" align="inherit" className="my-0">
                新しいメールアドレス宛に確認メールが送信されます。
                メール内のリンクをクリックすると変更が完了します。
              </Para>
              <Stack gap="xs">
                <Button
                  type="button"
                  onClick={handleSend}
                  disabled={!editEmail.trim()}
                  loading={isLoading}
                  loadingLabel="送信中..."
                  className="w-full"
                >
                  確認メールを送信
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsChanging(false)}
                  className="w-full"
                >
                  キャンセル
                </Button>
              </Stack>
            </Stack>
          )}
        </Block>
      </Stack>
    </Section>
  );
}
