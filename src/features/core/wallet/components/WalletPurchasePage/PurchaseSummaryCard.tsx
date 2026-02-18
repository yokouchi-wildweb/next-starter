// src/features/core/wallet/components/WalletPurchasePage/PurchaseSummaryCard.tsx

import { Stack } from "@/components/Layout/Stack";
import { Flex } from "@/components/Layout/Flex";
import { Section } from "@/components/Layout/Section";
import { Span } from "@/components/TextBlocks";
import type { WalletType } from "@/config/app/currency.config";
import { getCurrencyConfig } from "@/features/core/wallet/utils/currency";
import { CurrencyDisplay } from "../common/CurrencyDisplay";

type PurchaseSummaryCardProps = {
  purchaseAmount: number;
  paymentAmount: number;
  currentBalance: number;
  walletType: WalletType;
  /** 割引額（クーポン適用時） */
  discountAmount?: number;
  /** 割引前の金額（クーポン適用時） */
  originalPaymentAmount?: number;
};

export function PurchaseSummaryCard({
  purchaseAmount,
  paymentAmount,
  currentBalance,
  walletType,
  discountAmount,
  originalPaymentAmount,
}: PurchaseSummaryCardProps) {
  const config = getCurrencyConfig(walletType);
  const balanceAfterPurchase = currentBalance + purchaseAmount;
  const hasDiscount = discountAmount != null && discountAmount > 0;

  return (
    <Section className="-mx-4 bg-gray-100 px-4 py-4">
      <Stack className="rounded-lg bg-white" padding="lg" space={4}>
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
          {hasDiscount ? (
            <Stack space={1} className="items-end">
              <Span size="sm" tone="muted" className="line-through">
                ¥{(originalPaymentAmount ?? paymentAmount).toLocaleString()}
              </Span>
              <Span weight="bold" size="lg">
                ¥{paymentAmount.toLocaleString()}
              </Span>
            </Stack>
          ) : (
            <Span weight="bold" size="lg">
              ¥{paymentAmount.toLocaleString()}
            </Span>
          )}
        </Flex>
        {hasDiscount && (
          <Flex justify="between" align="center" className="border-t border-gray-200 py-2">
            <Span tone="muted">クーポン割引</Span>
            <Span weight="bold" tone="success">
              -¥{discountAmount.toLocaleString()}
            </Span>
          </Flex>
        )}
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
      </Stack>
    </Section>
  );
}
