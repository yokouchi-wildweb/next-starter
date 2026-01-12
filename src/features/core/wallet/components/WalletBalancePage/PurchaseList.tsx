// src/features/core/wallet/components/WalletBalancePage/PurchaseList.tsx

"use client";

import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Section } from "@/components/Layout/Section";
import { SecTitle, Span } from "@/components/TextBlocks";
import { LinkButton } from "@/components/Form/Button/LinkButton";
import type { WalletType } from "@/config/app/currency.config";
import type { CurrencyConfig } from "@/features/core/wallet/types/currency";
import { CurrencyDisplay } from "../common/CurrencyDisplay";

type PurchaseListProps = {
  /** URLスラッグ */
  slug: string;
  /** 通貨設定 */
  config: CurrencyConfig & { walletType: WalletType };
};

export function PurchaseList({ slug, config }: PurchaseListProps) {
  return (
    <Section space="sm">
      <SecTitle as="h2" size="lg">
        {config.label}購入
      </SecTitle>
      <Block space="none">
        {config.packages.map((pkg) => (
          <Flex
            key={pkg.amount}
            justify="between"
            align="center"
            className="border-b-2 border-gray-100 py-4 last:border-b-0"
          >
            <Flex align="center" gap="xs">
              <CurrencyDisplay
                walletType={config.walletType}
                amount={pkg.amount}
                size="lg"
                showUnit
              />
              {pkg.bonus && (
                <Span size="sm" tone="success">
                  {pkg.bonus}
                </Span>
              )}
            </Flex>
            <LinkButton
              href={`/wallet/${slug}/purchase?amount=${pkg.amount}&price=${pkg.price}`}
              variant="default"
              size="sm"
              className="min-w-24 rounded-full"
            >
              ¥{pkg.price.toLocaleString()}
            </LinkButton>
          </Flex>
        ))}
      </Block>
    </Section>
  );
}
