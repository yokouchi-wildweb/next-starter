// src/features/core/purchaseRequest/components/PurchaseCallback/index.tsx

"use client";

import { useSearchParams } from "next/navigation";
import { Stack } from "@/components/Layout/Stack";
import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks/Para";
import { InlineLoader } from "@/components/Overlays/Loading/InlineLoader";
import { LinkButton } from "@/components/Button/LinkButton";
import { usePurchaseStatusPolling } from "../../hooks/usePurchaseStatusPolling";

type PurchaseCallbackProps = {
  /** URLスラッグ */
  slug: string;
};

export function PurchaseCallback({ slug }: PurchaseCallbackProps) {
  const searchParams = useSearchParams();
  const requestId = searchParams.get("request_id");

  const { error } = usePurchaseStatusPolling({ requestId, slug });

  if (error) {
    return (
      <Stack gap="xl">
        <Para tone="destructive" align="center">
          {error}
        </Para>
        <Flex justify="center">
          <LinkButton href={`/wallet/${slug}`} variant="outline">
            戻る
          </LinkButton>
        </Flex>
      </Stack>
    );
  }

  return (
    <Stack gap="xl">
      <Flex direction="column" align="center" gap="lg">
        <InlineLoader size="lg" message="決済結果を確認中です..." />
        <Para align="center" tone="muted" size="sm">
          しばらくお待ちください
        </Para>
      </Flex>
    </Stack>
  );
}
