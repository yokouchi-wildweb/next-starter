// src/features/core/messaging/components/common/OverrideFieldMarks/index.tsx
// 部品(props だけ): 文言の欄の印(直した・コードが変わった・孤立 = 送る時はコードの値・直せなくなった)

"use client";

import { SoftBadge } from "@/components/Badge";
import { Flex } from "@/components/Layout/Flex";

import type { AdminOverrideField } from "@/features/core/messaging/services/client/overrideClient";

export type OverrideFieldMarksProps = {
  field: Pick<AdminOverrideField, "edited" | "codeChanged" | "orphan" | "editable">;
  /** 保存していない下書きがある */
  dirty?: boolean;
};

export function OverrideFieldMarks({ field, dirty = false }: OverrideFieldMarksProps) {
  return (
    <Flex align="center" gap="xs" wrap="wrap" data-slot="override-field-marks">
      {field.edited ? (
        <SoftBadge variant="info" size="sm">
          直した
        </SoftBadge>
      ) : null}
      {field.codeChanged ? (
        <SoftBadge variant="warning" size="sm">
          コードが変わった
        </SoftBadge>
      ) : null}
      {field.orphan ? (
        <SoftBadge variant="destructive" size="sm">
          孤立(コードの値で送る)
        </SoftBadge>
      ) : null}
      {!field.editable ? (
        <SoftBadge variant="muted" size="sm">
          直せなくなった欄
        </SoftBadge>
      ) : null}
      {dirty ? (
        <SoftBadge variant="outline" size="sm">
          未保存
        </SoftBadge>
      ) : null}
    </Flex>
  );
}
