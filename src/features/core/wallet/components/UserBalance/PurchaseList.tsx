// src/features/core/wallet/components/UserBalance/PurchaseList.tsx

"use client";

import { CircleDollarSign } from "lucide-react";

import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Section } from "@/components/Layout/Section";
import { SecTitle, Span } from "@/components/TextBlocks";
import { LinkButton } from "@/components/Form/Button/LinkButton";

/** 購入パッケージプレビュー */
const PREVIEW_PACKAGES: { amount: number; price: number; bonus?: string }[] = [
  { amount: 100, price: 100 },
  { amount: 500, price: 480, bonus: "4%お得" },
  { amount: 1000, price: 900, bonus: "10%お得" },
];

type PurchaseListProps = {
  label: string;
  onPurchase?: () => void;
};

export function PurchaseList({ label, onPurchase }: PurchaseListProps) {
  return (
    <Section space="sm">
      <SecTitle as="h2" size="lg">
        {label}購入
      </SecTitle>
      <Block space="none">
        {PREVIEW_PACKAGES.map((pkg) => (
          <Flex
            key={pkg.amount}
            justify="between"
            align="center"
            className="border-b-2 border-gray-100 py-4 last:border-b-0"
          >
            <Flex align="center" gap="xs">
              <CircleDollarSign className="size-5 text-coin" />
              <Span size="lg" weight="medium" className="text-coin">
                {pkg.amount.toLocaleString()}
              </Span>
              {pkg.bonus && (
                <Span size="sm" tone="success">
                  {pkg.bonus}
                </Span>
              )}
            </Flex>
            <Span weight="bold">¥{pkg.price.toLocaleString()}</Span>
          </Flex>
        ))}
      </Block>
      <Flex justify="center" className="mt-4">
        {onPurchase ? (
          <button
            onClick={onPurchase}
            className="w-full max-w-xs rounded-lg bg-primary px-6 py-3 font-bold text-white transition-colors hover:bg-primary/90"
          >
            {label}を購入する
          </button>
        ) : (
          <LinkButton
            href="/coins/purchase"
            variant="default"
            size="lg"
            className="w-full max-w-xs"
          >
            {label}を購入する
          </LinkButton>
        )}
      </Flex>
    </Section>
  );
}
