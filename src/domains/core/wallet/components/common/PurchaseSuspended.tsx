// src/domains/core/wallet/components/common/PurchaseSuspended.tsx

import { Wrench } from "lucide-react";

import { Flex } from "@/components/Layout/Flex";
import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { SecTitle } from "@/components/TextBlocks/SecTitle";
import { Para } from "@/components/TextBlocks/Para";

type PurchaseSuspendedProps = {
  /** 表示メッセージ */
  message: string;
};

export function PurchaseSuspended({ message }: PurchaseSuspendedProps) {
  return (
    <Section>
      <Stack gap="lg" className="py-8 text-center">
        <Flex justify="center">
          <Flex align="center" justify="center" className="h-16 w-16 rounded-full bg-muted">
            <Wrench className="h-8 w-8 text-muted-foreground" />
          </Flex>
        </Flex>
        <Stack gap="xs">
          <SecTitle as="h2" size="lg" align="center">
            メンテナンス中
          </SecTitle>
          <Para tone="muted" align="center">
            {message}
          </Para>
        </Stack>
      </Stack>
    </Section>
  );
}
