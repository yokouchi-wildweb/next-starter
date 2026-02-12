// src/features/core/user/components/Withdraw/index.tsx

"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/Form/Button/Button";
import { Flex } from "@/components/Layout/Flex";
import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import Modal from "@/components/Overlays/Modal";
import { Checkbox } from "@/components/_shadcn/checkbox";
import { Label } from "@/components/Form/Label";
import { Para } from "@/components/TextBlocks";
import { useWithdraw } from "@/features/core/auth/hooks/useWithdraw";
import { AccountPageHeader } from "@/features/core/user/components/UserMyPage/AccountPageHeader";

import { WithdrawDescription } from "./WithdrawDescription";

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
      <Stack space={4}>
        <AccountPageHeader
          title="退会"
          backHref="/mypage/other"
          backDisabled={isLoading}
        />
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <Stack space={4}>
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
        </div>
      </Stack>

      <Modal
        open={isModalOpen}
        onOpenChange={handleCloseModal}
        title="退会の確認"
        maxWidth={480}
      >
        <Flex direction="column" gap="lg">
          <Para tone="muted" size="sm" className="mt-0">
            本当に退会しますか？この操作は取り消すことができません。
          </Para>

          <Label className="flex items-center gap-3 cursor-pointer">
            <Checkbox
              checked={isAgreed}
              onCheckedChange={(checked) => setIsAgreed(Boolean(checked))}
              disabled={isLoading}
            />
            <span className="text-sm">退会することに同意します</span>
          </Label>

          {error && (
            <Para tone="destructive" size="sm" className="mt-0">
              {error.message}
            </Para>
          )}

          <Flex gap="sm" justify="end">
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
