// src/features/core/wallet/components/WalletBalancePage/BalanceCard.tsx

import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Section } from "@/components/Layout/Section";
import { Span } from "@/components/TextBlocks";
import type { CurrencyConfig, WalletType } from "@/features/core/wallet/currencyConfig";
import { CurrencyDisplay } from "../common/CurrencyDisplay";

type BalanceCardProps = {
  balance: number;
  config: CurrencyConfig & { walletType: WalletType };
};

export function BalanceCard({ balance, config }: BalanceCardProps) {
  return (
    <Section className="-mx-4 bg-gray-100 px-4 py-4">
      <Block className="rounded-lg bg-white" padding="lg">
        <Flex direction="column" align="center" gap="xs">
          <Span size="sm" tone="muted">
            保有{config.label}
          </Span>
          <CurrencyDisplay
            walletType={config.walletType}
            amount={balance}
            size="xl"
            showUnit
            bold
          />
        </Flex>
        <Block className="mt-4 border-t border-gray-200 pt-4">
          <Flex justify="between" align="center">
            <Span size="sm" tone="muted">
              {config.label}
            </Span>
            <CurrencyDisplay
              walletType={config.walletType}
              amount={balance}
              size="lg"
              showUnit
            />
          </Flex>
        </Block>
      </Block>
    </Section>
  );
}
