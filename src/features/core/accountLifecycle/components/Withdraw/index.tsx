// src/features/core/accountLifecycle/components/Withdraw/index.tsx

"use client";

import { useState, useCallback } from "react";
import { useRouter } from "@/lib/unsavedGuard";

import { Button } from "@/components/Button/Button";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import Modal from "@/components/Overlays/Modal";
import { BooleanCheckboxInput } from "@/components/Input/BooleanCheckboxInput";
import { Label } from "@/components/Input/Label";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";
import { useWithdraw } from "@/features/core/accountLifecycle/hooks/useWithdraw";
import { AccountPageHeader } from "@/features/core/user/components/common/AccountPageHeader";

import { WithdrawDescription } from "./WithdrawDescription";

export { WithdrawDescription } from "./WithdrawDescription";

export function Withdraw() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAgreed, setIsAgreed] = useState(false);
  const { withdraw, isLoading, error } = useWithdraw();

  const handleOpenModal = useCallback(() => {
    setIsModalOpen(true);
    setIsAgreed(false);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setIsAgreed(false);
  }, []);

  const handleWithdraw = useCallback(async () => {
    try {
      await withdraw();
    } catch {
      // エラーは useWithdraw 内で処理済み
    }
  }, [withdraw]);

  return (
    <Section>
      <Stack gap="md">
        <AccountPageHeader
          title="退会"
          backHref="/mypage/other"
          backDisabled={isLoading}
        />
        <Block className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <Stack gap="md">
            <WithdrawDescription />
            <Button
              variant="destructive"
              onClick={handleOpenModal}
            >
              退会する
            </Button>
            <Button
              variant="outline"
              onClick={() => router.back()}
            >
              キャンセル
            </Button>
          </Stack>
        </Block>
      </Stack>

      <Modal
        open={isModalOpen}
        onOpenChange={handleCloseModal}
        title="退会の確認"
        maxWidth={480}
      >
        <Flex direction="column" gap="xl">
          <Para tone="muted" size="sm" className="mt-0">
            本当に退会しますか？この操作は取り消すことができません。
          </Para>

          <Label className="flex items-center gap-3 cursor-pointer">
            <BooleanCheckboxInput
              value={isAgreed}
              onChange={(checked) => setIsAgreed(Boolean(checked))}
              disabled={isLoading}
            />
            <Span size="sm" weight="inherit">退会することに同意します</Span>
          </Label>

          {error && (
            <Para tone="destructive" size="sm" className="mt-0">
              {error.message}
            </Para>
          )}

          <Flex gap="md" justify="end">
            <Button
              variant="outline"
              onClick={handleCloseModal}
              disabled={isLoading}
            >
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={handleWithdraw}
              disabled={!isAgreed || isLoading}
            >
              {isLoading ? "処理中..." : "退会する"}
            </Button>
          </Flex>
        </Flex>
      </Modal>
    </Section>
  );
}

export default Withdraw;
