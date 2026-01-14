// src/features/core/user/components/Withdraw/index.tsx

"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/Form/Button/Button";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import Modal from "@/components/Overlays/Modal";
import { Checkbox } from "@/components/_shadcn/checkbox";
import { Label } from "@/components/Form/Label";
import { Para, SecTitle } from "@/components/TextBlocks";
import { useWithdraw } from "@/features/core/auth/hooks/useWithdraw";

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
    <>
      <Block appearance="outlined" padding="lg">
        <Flex direction="column" gap="md">
          <SecTitle as="h2">退会について</SecTitle>
          <Para tone="muted" size="sm">
            退会すると、アカウントに関連するデータにアクセスできなくなります。
            退会後に再度サービスを利用する場合は、新規登録が必要です。
          </Para>
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
        </Flex>
      </Block>

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
    </>
  );
}

export default Withdraw;
