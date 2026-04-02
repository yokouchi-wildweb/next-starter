// src/features/core/wallet/components/WalletBalancePage/PurchaseList.tsx

"use client";

import { Stack } from "@/components/Layout/Stack";
import { Flex } from "@/components/Layout/Flex";
import { Section } from "@/components/Layout/Section";
import { SecTitle, Span } from "@/components/TextBlocks";
import { LinkButton } from "@/components/Form/Button/LinkButton";
import type { WalletType } from "@/config/app/currency.config";
import type { CurrencyConfig } from "@/features/core/wallet/types/currency";
import type { PurchaseDiscountEffect } from "@/features/core/purchaseRequest/types/couponEffect";
import { calculatePackageDiscount, formatPackageDiscountLabel } from "@/features/core/wallet/utils/discountCalculator";
import { CurrencyDisplay } from "../common/CurrencyDisplay";

type PurchaseListProps = {
  /** URLスラッグ */
  slug: string;
  /** 通貨設定 */
  config: CurrencyConfig & { walletType: WalletType };
  /** 適用中のクーポン効果（割引条件） */
  couponEffect?: PurchaseDiscountEffect | null;
};

export function PurchaseList({ slug, config, couponEffect }: PurchaseListProps) {
  const hasDiscount = couponEffect != null;
  const isPerPackage = couponEffect?.discountMode === "per_package";



  return (
    <Section>
      <Stack space={4}>
        <SecTitle as="h2" size="lg">
          {config.label}購入
        </SecTitle>
        <Stack space={0}>
        {config.packages.map((pkg) => {
          const discount = hasDiscount
            ? calculatePackageDiscount(couponEffect, pkg.price, pkg.amount)
            : 0;
          const discountedPrice = pkg.price - discount;
          const isDiscountValid = discount > 0 && discountedPrice > 0;
          // per_package: パッケージ別ラベル / flat: 全パッケージ共通ラベル
          const discountLabel = hasDiscount
            ? formatPackageDiscountLabel(couponEffect, isPerPackage ? pkg.amount : undefined)
            : null;

          return (
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
                  <Span size="sm" tone="secondary">
                    {pkg.bonus}
                  </Span>
                )}
              </Flex>
              <Flex align="center" gap="sm">
                {isDiscountValid && discountLabel && (
                  <Span size="sm" tone="accent" weight="bold">
                    {discountLabel}
                  </Span>
                )}
              <LinkButton
                href={`/wallet/${slug}/purchase?amount=${pkg.amount}&price=${pkg.price}`}
                variant="default"
                size="sm"
                className="min-w-24 rounded-full"

              >
                {isDiscountValid ? (
                  <Stack space={0} className="items-center">
                    <span className="text-xs line-through opacity-50">
                      ¥{pkg.price.toLocaleString()}
                    </span>
                    <span>¥{discountedPrice.toLocaleString()}</span>
                  </Stack>
                ) : (
                  `¥${pkg.price.toLocaleString()}`
                )}
              </LinkButton>
              </Flex>
            </Flex>
          );
        })}
        </Stack>
      </Stack>
    </Section>
  );
}
