// src/features/core/purchaseRequest/components/BankTransferInstructionPage/StepConnector.tsx
//
// ① ② ③ のステップ間に挟む下向き矢印のインジケータ。
// 操作の流れ（縦に進む手順）を視覚的に伝えるための最小限のシェブロン。
// 高さを取らないよう装飾は控えめにしている。

import { ChevronDown } from "lucide-react";

import { Flex } from "@/components/Layout/Flex";

export function StepConnector() {
  return (
    // -my-3: 親 Stack の gap (20px) を上下 12px ずつ詰めて 8px 相当の余白に圧縮。
    // 余白を縮めた分、矢印は primary 色 + h-6 w-6 + strokeWidth=3 で視認性を上げる。
    <Flex justify="center" aria-hidden className="-my-3">
      <ChevronDown
        className="h-6 w-6 text-primary"
        strokeWidth={3}
      />
    </Flex>
  );
}
