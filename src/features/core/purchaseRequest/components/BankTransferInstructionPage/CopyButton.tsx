// src/features/core/purchaseRequest/components/BankTransferInstructionPage/CopyButton.tsx
//
// 文字列をクリップボードにコピーする小ボタン。
// 振込先情報・識別子のコピー UX に使う。

"use client";

import { Copy } from "lucide-react";

import { Button } from "@/components/Form/Button/Button";
import { useToast } from "@/lib/toast";

type Props = {
  /** コピー対象の文字列 */
  value: string;
  /** ボタンに表示するラベル */
  label: string;
};

export function CopyButton({ value, label }: Props) {
  const { showToast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      showToast("コピーしました", "success");
    } catch {
      showToast("コピーに失敗しました", "error");
    }
  };

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
      <Copy className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}
