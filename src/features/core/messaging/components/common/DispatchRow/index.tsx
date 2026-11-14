// src/features/core/messaging/components/common/DispatchRow/index.tsx
// 部品(props だけ): 管理の回の一覧の 1 行(件名・題、状態、種別・カテゴリーの表示名、経路、宛先の数、作った日時)。詳細へのリンク。
// 定義の鍵・送り元の鍵は見せない(D46: 運営する人は鍵を読まない)。カテゴリーの表示名は置き場が渡す(useAdminDispatchCategories の labelOf)

"use client";

import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Link } from "@/components/Navigation/Link";
import { Span } from "@/components/TextBlocks/Span";

import { messageChannelLabel } from "@/features/core/messaging/constants/channelLabels";
import { MESSAGE_KIND_LABELS } from "@/features/core/messaging/constants/kindLabels";
import type { AdminDispatchSummary } from "@/features/core/messaging/services/client/adminMessagingClient";

import { DispatchStatusBadge } from "../DispatchStatusBadge";

/** 日時の表示(ja-JP)。null・読めない値は「-」 */
export function formatAdminDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("ja-JP");
}

/** 回の見出し(経路ごとの件名・題の最初。無ければ「(件名なし)」。定義の鍵は出さない) */
export function dispatchHeading(dispatch: Pick<AdminDispatchSummary, "headings">): string {
  const first = Object.values(dispatch.headings ?? {}).find((text) => text.trim() !== "");
  return first ?? "(件名なし)";
}

/** 種別の表示名(知らない値・null は null) */
export function dispatchKindLabel(kind: string | null | undefined): string | null {
  return kind ? ((MESSAGE_KIND_LABELS as Record<string, string>)[kind] ?? null) : null;
}

export type DispatchRowProps = {
  dispatch: AdminDispatchSummary;
  /** 詳細の住所(既定 /admin/messaging/<id>) */
  href?: string;
  /** カテゴリーの表示名(取れない時は出さない) */
  categoryLabel?: string | null;
};

export function DispatchRow({ dispatch, href, categoryLabel = null }: DispatchRowProps) {
  const kindLabel = dispatchKindLabel(dispatch.kind);
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
          {kindLabel ? <Span size="sm" tone="muted">{kindLabel}</Span> : null}
          {categoryLabel ? <Span size="sm" tone="muted">{categoryLabel}</Span> : null}
          <Span size="sm" tone="muted">
            {dispatch.channels.map(messageChannelLabel).join(" / ")}
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
