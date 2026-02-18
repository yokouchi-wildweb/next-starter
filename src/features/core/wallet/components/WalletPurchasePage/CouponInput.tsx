// 購入ページ用クーポン入力コンポーネント

"use client";

import { useState, useCallback, useEffect } from "react";
import { Stack } from "@/components/Layout/Stack";
import { Flex } from "@/components/Layout/Flex";
import { Section } from "@/components/Layout/Section";
import { Input } from "@/components/Form/Input/Manual/Input";
import { Button } from "@/components/Form/Button/Button";
import { Span } from "@/components/TextBlocks";
import { Para } from "@/components/TextBlocks/Para";
import { Spinner } from "@/components/Overlays/Loading/Spinner";
import { useValidateCouponForCategory } from "@/features/core/coupon/hooks/useValidateCouponForCategory";
import { PURCHASE_DISCOUNT_CATEGORY, type PurchaseDiscountEffect } from "@/features/core/purchaseRequest/types/couponEffect";
import { consumeCouponCode } from "@/features/core/wallet/utils/couponParam";

type CouponInputProps = {
  /** 元の支払い金額（割引計算のmetadataとして送信） */
  paymentAmount: number;
  /** クーポン適用時のコールバック */
  onApply: (couponCode: string, effect: PurchaseDiscountEffect) => void;
  /** クーポン取り消し時のコールバック */
  onClear: () => void;
};

export function CouponInput({ paymentAmount, onApply, onClear }: CouponInputProps) {
  const [code, setCode] = useState("");
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [appliedEffect, setAppliedEffect] = useState<PurchaseDiscountEffect | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { validate, isLoading } = useValidateCouponForCategory();

  // sessionStorageから保存済みクーポンコードを自動入力
  useEffect(() => {
    const saved = consumeCouponCode();
    if (saved) {
      setCode(saved);
    }
  }, []);

  const handleApply = useCallback(async () => {
    if (!code.trim()) return;
    setErrorMessage(null);

    try {
      const res = await validate(code.trim(), PURCHASE_DISCOUNT_CATEGORY, { paymentAmount });

      if (res.valid) {
        const effect = res.effect as PurchaseDiscountEffect | null;
        if (effect) {
          setAppliedCode(code.trim());
          setAppliedEffect(effect);
          onApply(code.trim(), effect);
        } else {
          setErrorMessage("割引効果を取得できませんでした。");
        }
      } else {
        setErrorMessage(res.message);
      }
    } catch {
      setErrorMessage("クーポンの検証に失敗しました。");
    }
  }, [code, paymentAmount, validate, onApply]);

  const handleClear = useCallback(() => {
    setCode("");
    setAppliedCode(null);
    setAppliedEffect(null);
    setErrorMessage(null);
    onClear();
  }, [onClear]);

  // 適用済み状態
  if (appliedCode && appliedEffect) {
    return (
      <Section>
        <Stack space={2}>
          <Flex justify="between" align="center">
            <Span size="sm" tone="muted">クーポン</Span>
            <Button variant="ghost" size="xxs" onClick={handleClear}>
              取り消す
            </Button>
          </Flex>
          <Flex
            justify="between"
            align="center"
            className="rounded-lg border border-green-200 bg-green-50 px-3 py-2"
          >
            <Span size="sm" weight="medium">{appliedCode}</Span>
            <Span size="sm" tone="success" weight="bold">
              {appliedEffect.label ?? `${appliedEffect.discountAmount.toLocaleString()}円割引`}
            </Span>
          </Flex>
        </Stack>
      </Section>
    );
  }

  // 入力状態
  return (
    <Section>
      <Stack space={2}>
        <Span size="sm" tone="muted">クーポンコード</Span>
        <Flex gap="sm">
          <Input
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setErrorMessage(null);
            }}
            placeholder="コードを入力"
            disabled={isLoading}
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleApply();
              }
            }}
          />
          <Button
            variant="outline"
            size="md"
            onClick={handleApply}
            disabled={isLoading || !code.trim()}
          >
            {isLoading ? <Spinner className="h-4 w-4" /> : "適用"}
          </Button>
        </Flex>
        {errorMessage && (
          <Para tone="danger" size="sm">
            {errorMessage}
          </Para>
        )}
      </Stack>
    </Section>
  );
}
