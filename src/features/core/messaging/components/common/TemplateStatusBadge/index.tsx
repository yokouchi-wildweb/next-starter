// src/features/core/messaging/components/common/TemplateStatusBadge/index.tsx
// 部品(props だけ): テンプレートの状態(公開中・アーカイブ)と最新の版。下書きは無い(保存 = 公開、D134)

"use client";

import { SoftBadge, type SoftBadgeProps } from "@/components/Badge";

type Variant = NonNullable<SoftBadgeProps["variant"]>;

/** 状態 → 表示名・色(知らない値はそのまま灰色) */
export const TEMPLATE_STATUS_DISPLAY: Record<string, { label: string; variant: Variant }> = {
  published: { label: "公開中", variant: "success" },
  archived: { label: "アーカイブ", variant: "outline" },
};

export type TemplateStatusBadgeProps = {
  status: string;
  /** 最新の公開の版(あれば v<n>) */
  currentVersion?: number | null;
  size?: SoftBadgeProps["size"];
};

export function TemplateStatusBadge({ status, currentVersion, size = "sm" }: TemplateStatusBadgeProps) {
  const display = TEMPLATE_STATUS_DISPLAY[status] ?? { label: "その他", variant: "muted" as Variant };
  return (
    <SoftBadge variant={display.variant} size={size}>
      {display.label}
      {currentVersion ? ` v${currentVersion}` : ""}
    </SoftBadge>
  );
}
