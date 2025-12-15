// src/features/core/wallet/components/WalletPurchasePage/PurchaseSummaryCard.tsx

import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Section } from "@/components/Layout/Section";
import { Span } from "@/components/TextBlocks";
import { getCurrencyConfig, type WalletType } from "@/features/core/wallet/currencyConfig";
import { CurrencyDisplay } from "../common/CurrencyDisplay";

type PurchaseSummaryCardProps = {
  purchaseAmount: number;
  paymentAmount: number;
  currentBalance: number;
  walletType: WalletType;
};

export function PurchaseSummaryCard({
  purchaseAmount,
  paymentAmount,
  currentBalance,
  walletType,
}: PurchaseSummaryCardProps) {
  const config = getCurrencyConfig(walletType);
  const balanceAfterPurchase = currentBalance + purchaseAmount;

  return (
    <Section className="-mx-4 bg-gray-100 px-4 py-4">
      <Block className="rounded-lg bg-white" padding="lg" space="sm">
        <Flex justify="between" align="center" className="py-2">
          <Span tone="muted">ご購入{config.label}</Span>
          <CurrencyDisplay
            walletType={walletType}
            amount={purchaseAmount}
            size="md"
            showUnit
            bold
          />
        </Flex>
        <Flex justify="between" align="center" className="border-t border-gray-200 py-2">
          <Span tone="muted">お支払い金額</Span>
          <Span weight="bold" size="lg">
            ¥{paymentAmount.toLocaleString()}
          </Span>
        </Flex>
        <Flex justify="between" align="center" className="border-t border-gray-200 py-2">
          <Span tone="muted">購入後の{config.label}残高</Span>
          <CurrencyDisplay
            walletType={walletType}
            amount={balanceAfterPurchase}
            size="md"
            showUnit
            bold
          />
        </Flex>
      </Block>
    </Section>
  );
}
