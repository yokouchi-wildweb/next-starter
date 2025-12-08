// src/features/core/purchaseRequest/components/PurchaseCallback/index.tsx

"use client";

import { useSearchParams } from "next/navigation";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks/Para";
import { Spinner } from "@/components/Overlays/Loading/Spinner";
import { LinkButton } from "@/components/Form/Button/LinkButton";
import { usePurchaseStatusPolling } from "../../hooks/usePurchaseStatusPolling";

export function PurchaseCallback() {
  const searchParams = useSearchParams();
  const requestId = searchParams.get("request_id");

  const { error } = usePurchaseStatusPolling(requestId);

  if (error) {
    return (
      <Block space="lg">
        <Para tone="danger" align="center">
          {error}
        </Para>
        <Flex justify="center">
          <LinkButton href="/coins" variant="outline">
            コイン管理ページへ戻る
          </LinkButton>
        </Flex>
      </Block>
    );
  }

  return (
    <Block space="lg">
      <Flex direction="column" align="center" gap="md">
        <Spinner className="h-12 w-12 text-blue-600" />
        <Para align="center" size="lg">
          決済結果を確認中です...
        </Para>
        <Para align="center" tone="muted" size="sm">
          しばらくお待ちください
        </Para>
      </Flex>
    </Block>
  );
}
