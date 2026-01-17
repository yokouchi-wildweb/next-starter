// src/features/core/purchaseRequest/components/PurchaseCallback/index.tsx

"use client";

import { useSearchParams } from "next/navigation";
import { Stack } from "@/components/Layout/Stack";
import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks/Para";
import { Spinner } from "@/components/Overlays/Loading/Spinner";
import { LinkButton } from "@/components/Form/Button/LinkButton";
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
      <Stack space={8}>
        <Para tone="danger" align="center">
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
    <Stack space={8}>
      <Flex direction="column" align="center" gap="md">
        <Spinner className="h-12 w-12 text-blue-600" />
        <Para align="center" size="lg">
          決済結果を確認中です...
        </Para>
        <Para align="center" tone="muted" size="sm">
          しばらくお待ちください
        </Para>
      </Flex>
    </Stack>
  );
}
