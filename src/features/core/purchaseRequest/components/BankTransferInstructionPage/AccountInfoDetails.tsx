// src/features/core/purchaseRequest/components/BankTransferInstructionPage/AccountInfoDetails.tsx
//
// 振込先口座の詳細フィールド一覧。
// 「入金先口座を表示」ボタンで開く振込先口座モーダル内に表示する想定で、
// カードの枠やセクション見出しは含まず「中身だけ」を切り出している。
//
// 各フィールドの値が空文字のときは「（未設定）」表記でフォールバックし、
// 運用者の設定漏れを目視で気付かせる。

import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Span } from "@/components/TextBlocks";
import type { BankTransferConfig } from "@/config/app/payment.config";

import { CopyButton } from "./CopyButton";

type Props = {
  account: BankTransferConfig["account"];
};

const FALLBACK = "（未設定）";

function display(value: string): string {
  return value.trim() === "" ? FALLBACK : value;
}

/**
 * 支店名 + 支店コードを合成する。
 * - 両方あり: "渋谷支店 (123)"
 * - 名のみ:   "渋谷支店"
 * - 名なし:   "（未設定）"
 */
function formatBranch(branchName: string, branchCode: string): string {
  const name = branchName.trim();
  const code = branchCode.trim();
  if (name === "") return FALLBACK;
  return code === "" ? name : `${name} (${code})`;
}

export function AccountInfoDetails({ account }: Props) {
  const hasAccountNumber = account.accountNumber.trim() !== "";

  return (
    <Stack space={2}>
      {/*
        口座情報をテーブル風のカードに集約。
        - 外枠: 角丸 + ボーダー + ほんのり muted な背景でモーダル本体から浮かせる
        - 行間: divide-y で薄い区切り線を入れて情報のリズムを出す
      */}
      <Block className="overflow-hidden rounded-lg border border-border bg-muted/30 divide-y divide-border/60">
        <FieldRow label="銀行名" value={display(account.bankName)} />
        <FieldRow label="支店名" value={formatBranch(account.branchName, account.branchCode)} />
        <FieldRow label="種別" value={display(account.accountType)} />
        <FieldRow label="口座番号" value={display(account.accountNumber)} mono />
        <FieldRow label="名義" value={display(account.accountHolder)} />
      </Block>

      {/* コピーボタンは情報テーブルの下に中央配置（操作のリーチが行末から離れる方がバランスがよい） */}
      {hasAccountNumber && (
        <Flex justify="center">
          <CopyButton value={account.accountNumber} label="口座番号をコピー" />
        </Flex>
      )}
    </Stack>
  );
}

type FieldRowProps = {
  label: string;
  value: string;
  /** 等幅フォントで表示する（口座番号など数字主体のフィールド向け） */
  mono?: boolean;
};

function FieldRow({ label, value, mono = false }: FieldRowProps) {
  // 値は flex-1 + text-center で右側スペース内に中央揃え
  const valueClass = `flex-1 text-center ${mono ? "font-mono tracking-wider" : ""}`.trim();
  return (
    <Flex gap="sm" align="center" wrap="wrap" className="px-3 py-2">
      <Span size="xs" tone="muted" className="w-16 shrink-0">
        {label}
      </Span>
      <Span size="sm" weight="medium" className={valueClass}>
        {value}
      </Span>
    </Flex>
  );
}
