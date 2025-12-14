// src/features/wallet/components/AdminWalletAdjustModal/index.tsx

"use client";

import { useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import TabbedModal from "@/components/Overlays/TabbedModal";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks/Para";
import { AppForm } from "@/components/Form/AppForm";
import { FormFieldItem } from "@/components/Form/FormFieldItem";
import { NumberInput, TextInput } from "@/components/Form/Controlled";
import { RadioGroupInput } from "@/components/Form/Manual";
import { Button } from "@/components/Form/Button/Button";
import { err } from "@/lib/errors";
import type { User } from "@/features/core/user/entities";
import { WalletTypeOptions } from "@/features/core/wallet/constants/field";
import { CURRENCY_CONFIG } from "@/features/core/wallet/currencyConfig";
import { WalletHistoryChangeMethodOptions } from "@/features/core/walletHistory/constants/field";
import { useAdjustWallet } from "@/features/core/wallet/hooks/useAdjustWallet";
import { useWalletBalances } from "@/features/core/wallet/hooks/useWalletBalances";
import type { WalletAdjustRequestPayload } from "@/features/core/wallet/services/types";
import { walletMetaFieldDefinitions, type WalletMetaFieldName } from "@/features/core/wallet/constants/metaFields";
import { formatBalance } from "@/features/core/wallet/utils/formatters";

import {
  WalletAdjustDefaultValues,
  WalletAdjustFormSchema,
  type WalletAdjustFormValues,
} from "./formEntities";
import { MetaFieldsSection } from "./MetaFieldsSection";
import { WalletHistoryTabContent } from "./HistoryTabContent";

type Props = {
  open: boolean;
  user: User | null;
  onClose: () => void;
};

const adminFallback = "(未設定)";

const WALLET_TYPE_OPTIONS = WalletTypeOptions.map((option) => ({
  label: option.label,
  value: option.value,
}));

const CHANGE_METHOD_OPTIONS = WalletHistoryChangeMethodOptions.map((option) => ({
  label: option.label,
  value: option.value,
}));

export default function AdminWalletAdjustModal({ open, user, onClose }: Props) {
  const methods = useForm<WalletAdjustFormValues>({
    resolver: zodResolver(WalletAdjustFormSchema),
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: WalletAdjustDefaultValues,
  });

  const {
    control,
    reset,
    formState: { isSubmitting },
  } = methods;

  const { trigger, isMutating } = useAdjustWallet({ revalidateKeys: ["wallets"] });
  const { data: walletBalances } = useWalletBalances(user?.id);
  const changeMethod = useWatch({
    control,
    name: "changeMethod",
  });
  const amountDescription = useMemo(() => {
    if (changeMethod === "SET") {
      return "入力した値に残高を上書きします。ロック残高を下回る値は指定できません。";
    }
    if (changeMethod === "DECREMENT") {
      return "現在の利用可能残高から減算します。";
    }
    return "現在の残高に加算します。";
  }, [changeMethod]);

  useEffect(() => {
    if (open) {
      reset(WalletAdjustDefaultValues);
    }
  }, [open, reset]);

  if (!user) {
    return null;
  }

  const handleRequestClose = () => {
    reset(WalletAdjustDefaultValues);
    onClose();
  };

  const submit = async (values: WalletAdjustFormValues) => {
    const payload: WalletAdjustRequestPayload = {
      walletType: values.walletType,
      changeMethod: values.changeMethod,
      amount: Number(values.amount),
      reason: values.reason?.trim() ? values.reason.trim() : undefined,
      meta: createMeta(values),
    };

    const currencyLabel = CURRENCY_CONFIG[values.walletType].label;

    try {
      await trigger({ userId: user.id, payload });
      toast.success(`${currencyLabel}を更新しました`);
      handleRequestClose();
    } catch (error) {
      toast.error(err(error, `${currencyLabel}の操作に失敗しました`));
    }
  };

  const isProcessing = isSubmitting || isMutating;
  const regularBalance =
    walletBalances?.wallets.find((wallet) => wallet.type === "regular_point")?.balance ?? null;
  const temporaryBalance =
    walletBalances?.wallets.find((wallet) => wallet.type === "temporary_point")?.balance ?? null;

  const adjustTabContent = (
    <Block space="sm" padding="md">
      <Block
        className="rounded-md border border-border bg-card px-4 py-3"
        space="xs"
      >
        <Flex direction="column" gap="xs">
          <Flex justify="between" align="center" gap="lg" wrap="wrap">
            <div>
              <Para size="xs" tone="muted">
                対象ユーザー
              </Para>
              <Para>{user.displayName ?? adminFallback}</Para>
              <Para tone="muted" size="sm">
                {user.email ?? adminFallback}
              </Para>
            </div>
            <div className="text-right">
              <Para size="xs" tone="muted">
                現在のポイント
              </Para>
              <Para size="sm">
                通常: {formatBalance(regularBalance)} / 期間限定: {formatBalance(temporaryBalance)}
              </Para>
            </div>
          </Flex>
        </Flex>
      </Block>
      <AppForm methods={methods} onSubmit={submit} pending={isProcessing} fieldSpace="md">
        <FormFieldItem
          control={control}
          name="walletType"
          label="ウォレット種別"
          renderInput={(field) => (
            <RadioGroupInput
              field={field}
              options={WALLET_TYPE_OPTIONS}
              displayType="standard"
              buttonSize="sm"
              className="gap-2"
            />
          )}
        />
        <FormFieldItem
          control={control}
          name="changeMethod"
          label="操作方法"
          description={{
            text: "加算・減算は金額分の増減、セットは残高を指定値に置き換えます。",
            tone: "muted",
            size: "xs",
          }}
          renderInput={(field) => (
            <RadioGroupInput
              field={field}
              options={CHANGE_METHOD_OPTIONS}
              displayType="standard"
              buttonSize="sm"
              className="gap-2"
            />
          )}
        />
        <FormFieldItem
          control={control}
          name="amount"
          label="金額"
          description={{ text: amountDescription, tone: "muted", size: "xs" }}
          renderInput={(field) => (
            <NumberInput
              field={field}
              min={0}
              placeholder="例: 1000"
            />
          )}
        />
        <FormFieldItem
          control={control}
          name="reason"
          label="理由"
          description={{
            text: "ユーザーに通知するメッセージ用。200文字以内。",
            tone: "muted",
            size: "xs",
          }}
          renderInput={(field) => (
            <TextInput
              field={field}
              placeholder="例: 不具合補填として付与"
            />
          )}
        />
        <MetaFieldsSection control={control} />
        <Flex gap="sm" justify="end">
          <Button type="button" variant="outline" onClick={handleRequestClose}>
            キャンセル
          </Button>
          <Button type="submit" disabled={isProcessing}>
            {isProcessing ? "実行中..." : "実行"}
          </Button>
        </Flex>
      </AppForm>
    </Block>
  );

  return (
    <TabbedModal
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          handleRequestClose();
        }
      }}
      title="ポイント操作"
      maxWidth={810}
      height="60vh"
      tabs={[
        { value: "adjust", label: "ポイント操作", content: adjustTabContent },
        {
          value: "history",
          label: "操作履歴",
          content: <WalletHistoryTabContent userId={user.id} />,
          forceMount: true,
        },
      ]}
    />
  );
}

function createMeta(values: WalletAdjustFormValues) {
  const metaSource: Pick<WalletAdjustFormValues, WalletMetaFieldName> = values;
  const metaEntries: Record<string, string> = {};

  walletMetaFieldDefinitions.forEach(({ name }) => {
    const rawValue = metaSource[name];
    if (typeof rawValue === "string") {
      const trimmed = rawValue.trim();
      if (trimmed.length > 0) {
        metaEntries[name] = trimmed;
      }
    }
  });

  return Object.keys(metaEntries).length ? metaEntries : undefined;
}
