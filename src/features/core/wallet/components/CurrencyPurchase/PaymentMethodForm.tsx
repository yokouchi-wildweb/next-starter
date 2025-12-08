// src/features/core/wallet/components/CurrencyPurchase/PaymentMethodForm.tsx

"use client";

import { useState } from "react";

import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Section } from "@/components/Layout/Section";
import { SecTitle, Span } from "@/components/TextBlocks";
import { Para } from "@/components/TextBlocks/Para";
import { Button } from "@/components/Form/Button/Button";
import { Spinner } from "@/components/Overlays/Loading/Spinner";

const PAYMENT_METHODS = [
  { id: "credit_card", label: "クレジットカード" },
  { id: "amazon_pay", label: "Amazon Pay" },
  { id: "convenience_store", label: "コンビニ決済" },
  { id: "bank_transfer", label: "銀行振込" },
] as const;

type PaymentMethodId = (typeof PAYMENT_METHODS)[number]["id"];

type PaymentMethodFormProps = {
  onPurchase: (methodId: string) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
};

export function PaymentMethodForm({
  onPurchase,
  isLoading = false,
  error = null,
}: PaymentMethodFormProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodId>("credit_card");

  const handlePurchase = async () => {
    await onPurchase(selectedMethod);
  };

  return (
    <Section space="sm">
      <SecTitle as="h2" size="lg">
        お支払い方法
      </SecTitle>
      <Block space="sm">
        {PAYMENT_METHODS.map((method) => (
          <label
            key={method.id}
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
          >
            <input
              type="radio"
              name="paymentMethod"
              value={method.id}
              checked={selectedMethod === method.id}
              onChange={() => setSelectedMethod(method.id)}
              disabled={isLoading}
              className="size-5 accent-primary"
            />
            <Span weight="medium">{method.label}</Span>
          </label>
        ))}
      </Block>

      {error && (
        <Para tone="danger" size="sm" align="center">
          {error}
        </Para>
      )}

      <Flex justify="center" className="mt-6">
        <Button
          variant="default"
          size="lg"
          className="w-full max-w-xs"
          onClick={handlePurchase}
          disabled={isLoading}
        >
          {isLoading ? (
            <Flex align="center" gap="xs">
              <Spinner className="h-4 w-4" />
              <span>処理中...</span>
            </Flex>
          ) : (
            "購入する"
          )}
        </Button>
      </Flex>
    </Section>
  );
}
