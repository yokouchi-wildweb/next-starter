// src/features/core/purchaseRequest/components/BankTransferInstructionPage/AccountInfoCard.tsx
//
// ① 振込先口座セクションのサマリビュー。
// 中身（銀行名・支店名等の詳細）は表示せず、「入金先口座を表示」ボタンで
// 振込先口座モーダルを開く導線のみを提供する。
// モーダル本体は次工程で実装。現状はクリック時にスタブのトーストを表示。

"use client";

import { useState } from "react";
import { Eye } from "lucide-react";

import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Button } from "@/components/Form/Button/Button";
import { Span } from "@/components/TextBlocks";
import type { BankTransferConfig } from "@/config/app/payment.config";

import { BankAccountDetailsModal } from "./BankAccountDetailsModal";
import { ExpiryNotice } from "./ExpiryNotice";

type Props = {
  /** 振込先口座情報（モーダル内で表示） */
  account: BankTransferConfig["account"];
  /** 振込人名末尾に付与する識別子（モーダル内で表示） */
  identifier: string;
  /** 振込期限。null の場合は期限表示を省略 */
  expiresAt: Date | null;
};

export function AccountInfoCard({ account, identifier, expiresAt }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Block padding="md" className="rounded-lg border border-border bg-card">
        <Stack space={3}>
          <Span weight="semiBold" size="md">
            ① 振込先口座
          </Span>
          <Flex justify="center">
            <Button
              type="button"
              variant="default"
              size="lg"
              className="w-full max-w-xs"
              onClick={() => setOpen(true)}
            >
              <Eye className="h-4 w-4" />
              入金先口座を表示
            </Button>
          </Flex>
          {expiresAt && <ExpiryNotice expiresAt={expiresAt} />}
        </Stack>
      </Block>

      <BankAccountDetailsModal
        open={open}
        onOpenChange={setOpen}
        account={account}
        identifier={identifier}
      />
    </>
  );
}
