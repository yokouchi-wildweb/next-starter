// src/features/core/messaging/components/common/TemplateStatusBadge/index.tsx
// 部品(props だけ): テンプレートの状態(下書き・公開中・取り下げ)と、公開していない変更の印

"use client";

import { SoftBadge, type SoftBadgeProps } from "@/components/Badge";

type Variant = NonNullable<SoftBadgeProps["variant"]>;

/** 状態 → 表示名・色(知らない値はそのまま灰色) */
export const TEMPLATE_STATUS_DISPLAY: Record<string, { label: string; variant: Variant }> = {
  draft: { label: "下書き", variant: "muted" },
  published: { label: "公開中", variant: "success" },
  archived: { label: "取り下げ", variant: "outline" },
};

export type TemplateStatusBadgeProps = {
  status: string;
  /** 最新の公開の版(あれば v<n>) */
  currentVersion?: number | null;
  /** 公開していない変更がある */
  hasUnpublishedChanges?: boolean;
  size?: SoftBadgeProps["size"];
};

export function TemplateStatusBadge({ status, currentVersion, hasUnpublishedChanges, size = "sm" }: TemplateStatusBadgeProps) {
  const display = TEMPLATE_STATUS_DISPLAY[status] ?? { label: "そのほかの状態", variant: "muted" as Variant };
  return (
    <>
      <SoftBadge variant={display.variant} size={size}>
        {display.label}
        {currentVersion ? ` v${currentVersion}` : ""}
      </SoftBadge>
      {hasUnpublishedChanges && status === "published" ? (
        <SoftBadge variant="warning" size={size}>
          未公開の変更
        </SoftBadge>
      ) : null}
    </>
  );
}
