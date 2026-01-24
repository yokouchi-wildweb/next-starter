// src/features/core/wallet/components/WalletPurchasePage/PurchaseButton.tsx

"use client";

import { Stack } from "@/components/Layout/Stack";
import { Flex } from "@/components/Layout/Flex";
import { Section } from "@/components/Layout/Section";
import { Para } from "@/components/TextBlocks/Para";
import { Button } from "@/components/Form/Button/Button";
import { Spinner } from "@/components/Overlays/Loading/Spinner";

type PurchaseButtonProps = {
  onPurchase: () => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
};

export function PurchaseButton({
  onPurchase,
  isLoading = false,
  error = null,
}: PurchaseButtonProps) {
  const handlePurchase = async () => {
    await onPurchase();
  };

  return (
    <Section>
      <Stack space={4}>
        <Para size="sm" tone="muted" align="center">
          次画面でお支払い方法を選択できます
        </Para>

        {error && (
          <Para tone="danger" size="sm" align="center">
            {error}
          </Para>
        )}

        <Flex justify="center" className="mt-2">
          <Button
            variant="default"
            size="lg"
            className="w-full max-w-xs"
            onClick={handlePurchase}
            disabled={isLoading}
          >
            {isLoading ? (
              <Flex align="center" gap="xs">
                <Spinner className="h-4 w-4" />
                <span>処理中...</span>
              </Flex>
            ) : (
              "購入する"
            )}
          </Button>
        </Flex>
      </Stack>
    </Section>
  );
}
