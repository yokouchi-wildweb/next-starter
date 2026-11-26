// src/domains/core/wallet/components/AdminWalletBulkGrantAction/index.tsx
// 管理一覧の一括操作の作成関数: 選んだ利用者へのまとめての付与・補填(@/lib/crud の bulk*Action と同じ形 = meta + options → BulkActionItem)。
// 選んだ記録の id = 利用者 id。上流は項目を差さない(D304): fork が自分の一覧のドメインの plugs/adminBulkActions/<名前>.tsx で数行の項目にする
// (書き方: wallet README「一括付与と補填」)。中身は hook useBulkGrantWallet(= 管理の API = 運用コマンド wallet:bulk-grant と同じ関数)。
// 流れ: 入力(通貨・種類・全員に同じ額・理由・知らせ)→ 確かめる(dryRun: 付ける人数・合計・飛ばす人)→ 実行 → トースト → onDone。
// 確かめた後に入力を変えると確かめ直し(実行は新しい確かめの後だけ)。上限を超える選択は hook が束に分けて送る

"use client";

import { useState } from "react";
import { Coins } from "lucide-react";

import { Button } from "@/components/Button/Button";
import { BooleanCheckboxInput } from "@/components/Input/BooleanCheckboxInput";
import { Input } from "@/components/Input/Input";
import { Label } from "@/components/Input/Label";
import { SelectInput } from "@/components/Input/Select";
import { Textarea } from "@/components/Input/Textarea";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import Modal from "@/components/Overlays/Modal";
import { Para } from "@/components/TextBlocks/Para";
import { err } from "@/lib/errors";
import { useToast } from "@/lib/toast";
import type { BulkActionItem, BulkActionProps } from "@/lib/tableSuite";

import { walletConfig, type WalletType } from "@/domains/wallet/config";
import { useBulkGrantWallet } from "@/domains/core/wallet/hooks/useBulkGrantWallet";
import type { BulkGrantKind } from "@/domains/core/wallet/services/types";
import type { WalletTypeValue } from "@/domains/core/wallet/types/walletField";
import type { BulkGrantRunResult } from "@/domains/core/wallet/utils/bulkGrantChunks";

/** 項目の並べ方・出し分け(BulkActionItem の Component 以外) */
type ItemMeta<Access> = Omit<BulkActionItem<unknown, Access>, "Component">;

export type BulkWalletGrantActionOptions = {
  /** ボタンとモーダルの題 */
  label?: string;
  disabled?: boolean;
};

const KIND_OPTIONS: { value: BulkGrantKind; label: string }[] = [
  { value: "grant", label: "付与" },
  { value: "compensation", label: "お詫び・補填" },
];

const count = (n: number) => `${n.toLocaleString("ja-JP")} 人`;

type Draft = { walletType: string; kind: BulkGrantKind; amount: string; reason: string; notify: boolean };

const parseAmount = (value: string): number | null => {
  const amount = Number(value);
  return Number.isInteger(amount) && amount > 0 ? amount : null;
};

function GrantSelection({ selection, onDone, label }: BulkActionProps<unknown> & { label: string }) {
  const currencies = Object.entries(walletConfig.currency) as [WalletType, { label: string }][];
  const blank: Draft = { walletType: currencies[0]?.[0] ?? "", kind: "grant", amount: "", reason: "", notify: false };
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(blank);
  const [plan, setPlan] = useState<BulkGrantRunResult | null>(null);
  const [error, setError] = useState<unknown>(null);
  const { trigger, isMutating } = useBulkGrantWallet();
  const { showToast } = useToast();
  const ids = selection.selectedIds.map(String);
  const amount = parseAmount(draft.amount);
  const ready = draft.walletType !== "" && amount !== null && draft.reason.trim() !== "" && ids.length > 0;
  const currencyLabel = walletConfig.currency[draft.walletType as WalletType]?.label ?? draft.walletType;

  const edit = (patch: Partial<Draft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setPlan(null);
    setError(null);
  };
  const run = async (dryRun: boolean) => {
    if (amount === null) return;
    setError(null);
    try {
      const result = await trigger({
        walletType: draft.walletType as WalletTypeValue,
        kind: draft.kind,
        grants: ids.map((userId) => ({ userId, amount })),
        reason: draft.reason.trim(),
        notify: draft.notify,
        dryRun,
      });
      if (dryRun) {
        setPlan(result);
        return;
      }
      setOpen(false);
      showToast(`${currencyLabel}を ${count(result.granted.length)}に付けました(合計 ${result.total.toLocaleString("ja-JP")}、飛ばした ${count(result.skipped.length)})`, "success");
      onDone();
    } catch (caught) {
      setError(caught);
    }
  };
  const openModal = () => {
    setDraft(blank);
    setPlan(null);
    setError(null);
    setOpen(true);
  };

  return (
    <>
      <Button type="button" size="sm" variant="outline" disabled={selection.count === 0} onClick={openModal}>
        <Coins className="size-4" />
        {label}
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={label}
        maxWidth="560px"
        confirmOnClose={{ enabled: isMutating, message: "付与しています。閉じても処理は止まりません。閉じてもよろしいですか？" }}
        footer={
          <Flex justify="end" gap="xs">
            <Button type="button" size="sm" variant="outline" disabled={!ready} loading={isMutating && plan === null} onClick={() => void run(true)}>
              確かめる
            </Button>
            {plan ? (
              <Button type="button" size="sm" variant="primary" disabled={plan.granted.length === 0} loading={isMutating} onClick={() => void run(false)}>
                実行
              </Button>
            ) : null}
          </Flex>
        }
      >
        <Stack gap="sm">
          <Para size="sm" tone="muted" className="my-0">
            {`選択した ${count(ids.length)}に同じ額を付けます(先に「確かめる」で付ける人数と合計を見てから実行します)`}
          </Para>
          <Stack gap="2xs">
            <Label htmlFor="bulk-wallet-grant-currency" className="text-sm">
              通貨
            </Label>
            <SelectInput
              id="bulk-wallet-grant-currency"
              value={draft.walletType}
              options={currencies.map(([value, currency]) => ({ value, label: currency.label }))}
              disabled={isMutating}
              onChange={(v) => edit({ walletType: v ? String(v) : "" })}
            />
          </Stack>
          <Stack gap="2xs">
            <Label htmlFor="bulk-wallet-grant-kind" className="text-sm">
              種類
            </Label>
            <SelectInput
              id="bulk-wallet-grant-kind"
              value={draft.kind}
              options={KIND_OPTIONS}
              disabled={isMutating}
              onChange={(v) => edit({ kind: v === "compensation" ? "compensation" : "grant" })}
            />
          </Stack>
          <Stack gap="2xs">
            <Label htmlFor="bulk-wallet-grant-amount" className="text-sm">
              1 人あたりの額
            </Label>
            <Input id="bulk-wallet-grant-amount" type="number" min={1} step={1} value={draft.amount} disabled={isMutating} onChange={(e) => edit({ amount: e.target.value })} />
          </Stack>
          <Stack gap="2xs">
            <Label htmlFor="bulk-wallet-grant-reason" className="text-sm">
              理由(履歴と監査に残ります)
            </Label>
            <Textarea id="bulk-wallet-grant-reason" value={draft.reason} rows={2} maxLength={200} disabled={isMutating} onChange={(e) => edit({ reason: e.target.value })} />
          </Stack>
          <BooleanCheckboxInput id="bulk-wallet-grant-notify" value={draft.notify} label="付けた人に知らせを送る" disabled={isMutating} onChange={(notify) => edit({ notify })} />
          {plan ? (
            <Stack gap="2xs" data-slot="bulk-wallet-grant-plan">
              <Para size="sm" className="my-0">
                {`${currencyLabel}を ${count(plan.granted.length)}に付けます(合計 ${plan.total.toLocaleString("ja-JP")})`}
              </Para>
              {plan.skipped.length > 0 ? (
                <Para size="sm" tone="muted" className="my-0">
                  {`飛ばす ${count(plan.skipped.length)}: ${plan.skipped
                    .slice(0, 3)
                    .map((row) => row.why)
                    .join(" / ")}${plan.skipped.length > 3 ? " ほか" : ""}`}
                </Para>
              ) : null}
            </Stack>
          ) : null}
          {error ? (
            <Para size="sm" tone="destructive" className="my-0" data-slot="bulk-wallet-grant-error">
              {err(error, "付与に失敗しました")}
            </Para>
          ) : null}
        </Stack>
      </Modal>
    </>
  );
}

/** 選んだ利用者に同じ額をまとめて付ける(付与・お詫び・補填) */
export function bulkWalletGrantAction<Row = unknown, Access = unknown>(
  meta: ItemMeta<Access>,
  options: BulkWalletGrantActionOptions = {},
): BulkActionItem<Row, Access> {
  const label = options.label ?? "まとめて付与";
  const Component = (props: BulkActionProps<Row>) => (
    <GrantSelection {...(props as BulkActionProps<unknown>)} selection={{ ...props.selection, count: options.disabled ? 0 : props.selection.count }} label={label} />
  );
  Component.displayName = `bulkWalletGrantAction(${meta.key})`;
  return { ...meta, Component };
}
