// src/features/core/wallet/components/WalletPurchase/PurchaseButton.tsx

"use client";

import { Stack } from "@/components/Layout/Stack";
import { Flex } from "@/components/Layout/Flex";
import { Section } from "@/components/Layout/Section";
import { Para } from "@/components/TextBlocks/Para";
import { Button } from "@/components/Form/Button/Button";

type PurchaseButtonProps = {
  onPurchase: () => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
  /** ボタンを非活性にする（支払い方法未選択時など） */
  disabled?: boolean;
  /** disabled 時のボタンラベル。未指定時は通常ラベル「購入する」を表示 */
  disabledLabel?: string;
};

export function PurchaseButton({
  onPurchase,
  isLoading = false,
  error = null,
  disabled = false,
  disabledLabel,
}: PurchaseButtonProps) {
  const handlePurchase = async () => {
    await onPurchase();
  };

  return (
    <Section>
      <Stack gap="md">
        {error && (
          <Para tone="destructive" size="sm" align="center">
            {error}
          </Para>
        )}

        <Flex justify="center" className="mt-2">
          <Button
            variant="default"
            size="lg"
            className="w-full max-w-xs"
            onClick={handlePurchase}
            disabled={disabled}
            loading={isLoading}
            loadingLabel="処理中..."
          >
            {disabled && disabledLabel ? disabledLabel : "購入する"}
          </Button>
        </Flex>
      </Stack>
    </Section>
  );
}
