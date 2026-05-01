// src/features/core/purchaseRequest/components/BankTransferInstructionPage/BankAccountDetailsModal.tsx
//
// ① 振込先口座の詳細を表示するモーダル。
// 構成:
//   1. 振込人名末尾の数字に関する注意書き（destructive 色で強調）
//   2. 区切り線
//   3. 振込先口座のフィールド一覧（銀行名 / 支店名 / 種別 / 口座番号 / 名義）
//
// 振込人名識別子を最上部に置く意図:
// 振込人名の末尾に識別子を付け忘れると管理者側で振込と purchase_request の
// 紐付けができず、入金確認漏れにつながる。最重要情報として最初に視界に入れる。

"use client";

import Modal from "@/components/Overlays/Modal";
import { Stack } from "@/components/Layout/Stack";
import type { BankTransferConfig } from "@/config/app/payment.config";

import { AccountInfoDetails } from "./AccountInfoDetails";
import { TransferIdentifierCard } from "./TransferIdentifierCard";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 振込先口座情報（payment.config.ts から取得） */
  account: BankTransferConfig["account"];
  /** 振込人名末尾に付与する識別子（数字 8 桁） */
  identifier: string;
};

export function BankAccountDetailsModal({ open, onOpenChange, account, identifier }: Props) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="振込先口座"
      maxWidth={520}
      // p-4: モーダル内 padding をデフォルト p-6 (24px) → 16px に縮小
      // gap-4: ヘッダーと本文の縦 gap（タイトル下の余白）。デフォルト gap-4 (16px) を維持
      className="p-4 gap-4"
    >
      <Stack space={2}>
        <TransferIdentifierCard identifier={identifier} />
        <AccountInfoDetails account={account} />
      </Stack>
    </Modal>
  );
}
