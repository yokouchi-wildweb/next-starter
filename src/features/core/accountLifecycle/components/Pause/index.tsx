// src/features/core/accountLifecycle/components/Pause/index.tsx

"use client";

import { useState, useCallback } from "react";
import { useRouter } from "@/lib/unsavedGuard";

import { Button } from "@/components/Form/Button/Button";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import Modal from "@/components/Overlays/Modal";
import { BooleanCheckboxInput } from "@/components/Form/Input/Manual";
import { Label } from "@/components/Form/Label";
import { Para, Span } from "@/components/TextBlocks";
import { usePause } from "@/features/core/accountLifecycle/hooks/usePause";
import { AccountPageHeader } from "@/features/core/user/components/common/AccountPageHeader";

import { PauseDescription } from "./PauseDescription";

export { PauseDescription } from "./PauseDescription";

export function Pause() {
  const router = useRouter();
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
    <Section>
      <Stack gap="md">
        <AccountPageHeader
          title="休会"
          backHref="/mypage/other"
          backDisabled={isLoading}
        />
        <Block className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <Stack gap="md">
            <PauseDescription />
            <Button
              variant="outline"
              onClick={handleOpenModal}
            >
              休会する
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
        title="休会の確認"
        maxWidth={480}
      >
        <Flex direction="column" gap="xl">
          <Para tone="muted" size="sm" className="mt-0">
            本当に休会しますか？休会中はサービスを利用できません。
            いつでもログインして復帰することができます。
          </Para>

          <Label className="flex items-center gap-3 cursor-pointer">
            <BooleanCheckboxInput
              value={isAgreed}
              onChange={(checked) => setIsAgreed(Boolean(checked))}
              disabled={isLoading}
            />
            <Span size="sm" weight="inherit">休会することに同意します</Span>
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
              variant="outline"
              onClick={handlePause}
              disabled={!isAgreed || isLoading}
            >
              {isLoading ? "処理中..." : "休会する"}
            </Button>
          </Flex>
        </Flex>
      </Modal>
    </Section>
  );
}

export default Pause;
