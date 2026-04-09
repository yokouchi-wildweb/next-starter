// src/features/core/wallet/components/common/PurchaseSuspended.tsx

import { Wrench } from "lucide-react";

import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { SecTitle, Para } from "@/components/TextBlocks";

type PurchaseSuspendedProps = {
  /** 表示メッセージ */
  message: string;
};

export function PurchaseSuspended({ message }: PurchaseSuspendedProps) {
  return (
    <Section>
      <Stack space={6} className="py-8 text-center">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Wrench className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>
        <Stack space={2}>
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
