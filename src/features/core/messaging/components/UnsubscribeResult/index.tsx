// src/features/core/messaging/components/UnsubscribeResult/index.tsx
// 部品(props だけ): 配信停止の結果。done = 止めた(通知の設定のページへの案内。門で閉じていれば棚の Link が描かない)/ invalid = リンクが正しくない

import { Stack } from "@/components/Layout/Stack";
import { Link } from "@/components/Navigation";
import { Para } from "@/components/TextBlocks/Para";

import { MESSAGE_PREFERENCES_PAGE_PATH } from "@/features/core/messaging/constants/preferences";

export type UnsubscribeResultProps = {
  status: "done" | "invalid";
  /** 止めた種類の表示名(done の時) */
  categoryLabel?: string;
};

export function UnsubscribeResult({ status, categoryLabel }: UnsubscribeResultProps) {
  if (status === "invalid") {
    return (
      <Stack space={2}>
        <Para weight="bold">リンクが正しくありません</Para>
        <Para size="sm" tone="muted">
          メールのリンクをもう一度お確かめください。
        </Para>
      </Stack>
    );
  }
  return (
    <Stack space={2}>
      <Para weight="bold">配信を停止しました</Para>
      <Para size="sm" tone="muted">
        {categoryLabel ? `「${categoryLabel}」のお知らせは今後届きません。` : "このお知らせは今後届きません。"}
      </Para>
      <Para size="sm">
        <Link href={MESSAGE_PREFERENCES_PAGE_PATH} className="underline">
          通知の設定を見る
        </Link>
      </Para>
    </Stack>
  );
}
