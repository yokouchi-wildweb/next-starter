// 招待特典の説明セクション
//
// 下流プロジェクトでこのコンポーネントを差し替えて、
// 具体的な特典内容（ポイント付与、クーポン発行など）を記載する。

import { CheckCircleIcon, GiftIcon } from "lucide-react";

import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks";

const PLACEHOLDER_BENEFITS = [
  "招待した方に特典をプレゼント",
  "招待された方にも特典をプレゼント",
];

export function InviteBenefitsSection() {
  return (
    <div className="rounded-lg bg-gradient-to-br from-primary/5 to-transparent px-4 py-6">
      <Flex direction="column" align="center" gap="md">
        {/* アイコン */}
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/10">
          <GiftIcon className="h-7 w-7 text-primary" />
        </div>

        {/* タイトル・説明文 */}
        <Stack space={1}>
          <Para size="sm" weight="medium" className="!mb-0 text-center">
            招待特典
          </Para>
          <Para size="xs" tone="muted" className="!mb-0 text-center">
            紹介者と新規登録者の両方に特典があります。
          </Para>
        </Stack>

        {/* 特典リスト（下流で差し替え） */}
        <Stack space={2} className="items-center">
          {PLACEHOLDER_BENEFITS.map((benefit) => (
            <Flex key={benefit} align="center" gap="xs">
              <CheckCircleIcon className="h-4 w-4 shrink-0 text-primary/70" />
              <Para size="xs" tone="muted" className="!mb-0">
                {benefit}
              </Para>
            </Flex>
          ))}
        </Stack>
      </Flex>
    </div>
  );
}
