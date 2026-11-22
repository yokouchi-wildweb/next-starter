// src/features/core/messaging/components/common/DispatchDeleteSummary/index.tsx
// 部品(props だけ): 送信の削除の見込み(D88、delete-summary の結果)。確認の Dialog の中に出す。
// お知らせ(消せる送信チャンネル)は受け取った人から消える / メール・LINE(消せない送信チャンネル)は送信済みのため取り消せない(記録は残る) /
// 未送信・予約は送られない / 削除済みは対象外 / 元に戻せない

"use client";

import { Stack } from "@/components/Layout/Stack";
import { InlineLoader } from "@/components/Overlays/Loading";
import { Para } from "@/components/TextBlocks/Para";
import { err } from "@/lib/errors";

import type { AdminDeleteSummary } from "@/features/core/messaging/services/client/adminMessagingClient";

export type DispatchDeleteSummaryProps = {
  summary: AdminDeleteSummary | null;
  isLoading?: boolean;
  error?: unknown;
};

/** 見込みの文(行ごと)。数が 0 の行は出さない */
export function dispatchDeleteSummaryLines(summary: AdminDeleteSummary): string[] {
  const lines: string[] = [];
  const removable = summary.channels.filter((channel) => channel.removable);
  const inbox = removable.reduce((sum, channel) => sum + channel.sent, 0) + summary.sharedInbox;
  if (inbox > 0) lines.push(`${removable.map((channel) => channel.label).join("・") || "サービス内通知"} ${inbox} 件が受け取った人から消えます`);
  const kept = summary.channels.filter((channel) => !channel.removable && channel.sent > 0);
  const keptCount = kept.reduce((sum, channel) => sum + channel.sent, 0);
  if (keptCount > 0) lines.push(`${kept.map((channel) => channel.label).join("・")} ${keptCount} 件は送信済みのため取り消せません(記録は残ります)`);
  const pending = [summary.unsent > 0 ? `未送信 ${summary.unsent} 件` : null, summary.scheduled > 0 ? `予約 ${summary.scheduled} 件` : null].filter(Boolean);
  if (pending.length > 0) lines.push(`${pending.join("・")}は送信されません`);
  if (summary.deleted > 0) lines.push(`削除済みの ${summary.deleted} 件は対象外です`);
  return lines;
}

export function DispatchDeleteSummary({ summary, isLoading = false, error = null }: DispatchDeleteSummaryProps) {
  return (
    <Stack gap="xs" data-slot="dispatch-delete-summary">
      {isLoading && !summary ? (
        <InlineLoader size="sm" />
      ) : error && !summary ? (
        <Para size="sm" tone="destructive" className="my-0">
          {err(error, "削除の見込みを読み込めませんでした")}
        </Para>
      ) : summary ? (
        dispatchDeleteSummaryLines(summary).map((line) => (
          <Para key={line} size="sm" className="my-0">
            {line}
          </Para>
        ))
      ) : null}
      <Para size="sm" tone="destructive" className="my-0">
        削除は元に戻せません
      </Para>
    </Stack>
  );
}
