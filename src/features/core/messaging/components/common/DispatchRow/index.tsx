// src/features/core/messaging/components/common/DispatchRow/index.tsx
// 部品(props だけ): 管理の回の一覧の 1 行。1 段目 = 状態・件名(右に作った日時)、2 段目 = 印つきの 種別 › カテゴリー・送信方法の札・宛先(グループ宛てはグループ名)と数。詳細へのリンク。
// 定義の鍵・送り元の鍵は見せない(D46: 運営する人は鍵を読まない)。カテゴリーの表示名は置き場が渡す(useAdminDispatchCategories の labelOf)

"use client";

import type { ReactNode } from "react";
import { ChevronRight, Clock, Send, Tag, Users, type LucideIcon } from "lucide-react";

import { SoftBadge } from "@/components/Badge";
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

/** 宛先のグループの表示(グループ宛ての回だけ。名前が取れない = 門 userGroups が閉・消えた → 「グループ」。id は出さない、D94) */
export function dispatchTargetGroupLabel(dispatch: Pick<AdminDispatchSummary, "targetGroup">): string | null {
  if (!dispatch.targetGroup) return null;
  return dispatch.targetGroup.name ? `グループ「${dispatch.targetGroup.name}」` : "グループ";
}

/** 一覧の行の宛先(グループ宛て = 「宛先: グループ「名前」 N 名」、ほか = 「宛先 N 名」) */
export function dispatchTargetText(dispatch: Pick<AdminDispatchSummary, "targetGroup" | "recipientCount">): string {
  const group = dispatchTargetGroupLabel(dispatch);
  return group ? `宛先: ${group} ${dispatch.recipientCount} 名` : `宛先数 ${dispatch.recipientCount} 名`;
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

/** 2 段目の 1 つの項目(印 + 中身。印の意味は aria-label で読み上げる) */
function MetaItem({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <Flex align="center" gap="xs" className="min-w-0" aria-label={label} data-slot="dispatch-meta">
      <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      {children}
    </Flex>
  );
}

export function DispatchRow({ dispatch, href, categoryLabel = null }: DispatchRowProps) {
  const kindLabel = dispatchKindLabel(dispatch.kind);
  const group = dispatchTargetGroupLabel(dispatch);
  // 1 段目 = 状態・件名 … 右に作った日時 / 2 段目 = 種別 › カテゴリー ・ 送信方法(札)・ 宛先と数(どれも印つき)
  return (
    <Link
      href={href ?? `/admin/messaging/${encodeURIComponent(dispatch.id)}`}
      className="block rounded-md border border-border bg-card px-4 py-3 hover:bg-muted/40"
      data-slot="dispatch-row"
    >
      <Stack space={2}>
        <Flex align="center" justify="between" gap="sm" wrap="wrap">
          <Flex align="center" gap="xs" wrap="wrap" className="min-w-0">
            <DispatchStatusBadge status={dispatch.status} deletedAt={dispatch.deletedAt} />
            {dispatch.isTest ? (
              <SoftBadge variant="outline" size="sm">
                テスト
              </SoftBadge>
            ) : null}
            <Span weight="semiBold" className="min-w-0">
              {dispatchHeading(dispatch)}
            </Span>
          </Flex>
          <Flex align="center" gap="xs" className="shrink-0" aria-label="作成日時">
            <Clock className="size-3.5 text-muted-foreground" aria-hidden />
            <Span size="sm" tone="muted" className="tabular-nums">
              {formatAdminDateTime(dispatch.createdAt)}
            </Span>
          </Flex>
        </Flex>
        <Flex align="center" gap="md" wrap="wrap">
          {kindLabel || categoryLabel ? (
            <MetaItem icon={Tag} label="種別とカテゴリー">
              <Span size="sm">{kindLabel ?? "-"}</Span>
              {categoryLabel ? (
                <>
                  <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <Span size="sm">{categoryLabel}</Span>
                </>
              ) : null}
            </MetaItem>
          ) : null}
          <MetaItem icon={Send} label="送信方法">
            <Flex align="center" gap="xs" wrap="wrap">
              {dispatch.channels.map((channel) => (
                <SoftBadge key={channel} variant="outline" size="sm">
                  {messageChannelLabel(channel)}
                </SoftBadge>
              ))}
            </Flex>
          </MetaItem>
          <MetaItem icon={Users} label="宛先">
            <Span size="sm" data-slot="dispatch-target">
              {group ? `${group}・` : ""}
              <Span size="inherit" weight="semiBold" className="tabular-nums">
                {dispatch.recipientCount.toLocaleString("ja-JP")}
              </Span>
              {" 名"}
            </Span>
          </MetaItem>
        </Flex>
      </Stack>
    </Link>
  );
}
