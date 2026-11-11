// src/features/core/messaging/components/common/DispatchRow/index.tsx
// 部品(props だけ): 管理の回の一覧の 1 行(件名・題、状態、定義の鍵・種別・送り元、宛先の数、作った日時)。詳細へのリンク

"use client";

import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Link } from "@/components/Navigation/Link";
import { Span } from "@/components/TextBlocks/Span";

import type { AdminDispatchSummary } from "@/features/core/messaging/services/client/adminMessagingClient";

import { DispatchStatusBadge } from "../DispatchStatusBadge";

/** 日時の表示(ja-JP)。null・読めない値は「-」 */
export function formatAdminDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("ja-JP");
}

/** 回の見出し(経路ごとの件名・題の最初。無ければ定義の鍵 → 「(件名なし)」) */
export function dispatchHeading(dispatch: Pick<AdminDispatchSummary, "headings" | "messageKey">): string {
  const first = Object.values(dispatch.headings ?? {}).find((text) => text.trim() !== "");
  return first ?? dispatch.messageKey ?? "(件名なし)";
}

export type DispatchRowProps = {
  dispatch: AdminDispatchSummary;
  /** 詳細の住所(既定 /admin/messaging/<id>) */
  href?: string;
};

export function DispatchRow({ dispatch, href }: DispatchRowProps) {
  return (
    <Link
      href={href ?? `/admin/messaging/${encodeURIComponent(dispatch.id)}`}
      className="block rounded-md border border-border bg-card px-4 py-3 hover:bg-muted/40"
      data-slot="dispatch-row"
    >
      <Stack space={1}>
        <Flex align="center" gap="xs" wrap="wrap">
          <DispatchStatusBadge status={dispatch.status} retractedAt={dispatch.retractedAt} />
          {dispatch.isTest ? <Span size="sm" tone="muted">テスト</Span> : null}
          <Span weight="semiBold">{dispatchHeading(dispatch)}</Span>
        </Flex>
        <Flex align="center" gap="sm" wrap="wrap">
          <Span size="sm" tone="muted">
            {dispatch.messageKey ?? "(前の送る口)"}
          </Span>
          {dispatch.kind ? <Span size="sm" tone="muted">{dispatch.kind}</Span> : null}
          <Span size="sm" tone="muted">
            {dispatch.source}
          </Span>
          <Span size="sm" tone="muted">
            {dispatch.channels.join(" / ")}
          </Span>
          <Span size="sm" tone="muted">
            宛先 {dispatch.recipientCount} 名
          </Span>
          <Span size="sm" tone="muted">
            {formatAdminDateTime(dispatch.createdAt)}
          </Span>
        </Flex>
      </Stack>
    </Link>
  );
}
