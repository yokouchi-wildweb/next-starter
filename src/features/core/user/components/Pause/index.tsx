// src/features/core/user/components/Pause/index.tsx

"use client";

import { useState, useCallback } from "react";

import { Button } from "@/components/Form/Button/Button";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import Modal from "@/components/Overlays/Modal";
import { Checkbox } from "@/components/_shadcn/checkbox";
import { Label } from "@/components/Form/Label";
import { Para, SecTitle } from "@/components/TextBlocks";
import { usePause } from "@/features/core/auth/hooks/usePause";

export function Pause() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAgreed, setIsAgreed] = useState(false);
  const { pause, isLoading, error } = usePause();

  const handleOpenModal = useCallback(() => {
    setIsModalOpen(true);
    setIsAgreed(false);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setIsAgreed(false);
  }, []);

  const handlePause = useCallback(async () => {
    try {
      await pause();
    } catch {
      // エラーは usePause 内で処理済み
    }
  }, [pause]);

  return (
    <>
      <Block appearance="outlined" padding="lg">
        <Flex direction="column" gap="md">
          <SecTitle as="h2">休会について</SecTitle>
          <Para tone="muted" size="sm">
            休会すると、アカウントは一時的に利用停止状態となります。
            休会中はサービスを利用できませんが、いつでも復帰することができます。
          </Para>
          <Button
            variant="outline"
            onClick={handleOpenModal}
          >
            休会する
          </Button>
        </Flex>
      </Block>

      <Modal
        open={isModalOpen}
        onOpenChange={handleCloseModal}
        title="休会の確認"
        maxWidth={480}
      >
        <Flex direction="column" gap="lg">
          <Para tone="muted" size="sm" className="mt-0">
            本当に休会しますか？休会中はサービスを利用できません。
            いつでもログインして復帰することができます。
          </Para>

          <Label className="flex items-center gap-3 cursor-pointer">
            <Checkbox
              checked={isAgreed}
              onCheckedChange={(checked) => setIsAgreed(Boolean(checked))}
              disabled={isLoading}
            />
            <span className="text-sm">休会することに同意します</span>
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
              variant="outline"
              onClick={handlePause}
              disabled={!isAgreed || isLoading}
            >
              {isLoading ? "処理中..." : "休会する"}
            </Button>
          </Flex>
        </Flex>
      </Modal>
    </>
  );
}

export default Pause;
