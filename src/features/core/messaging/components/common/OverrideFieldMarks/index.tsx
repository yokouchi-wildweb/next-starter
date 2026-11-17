// src/features/core/messaging/components/common/OverrideFieldMarks/index.tsx
// 部品(props だけ): 文言の欄の印(直した・コードが変わった・使えない = 送る時はコードの値・直せなくなった)

"use client";

import { SoftBadge } from "@/components/Badge";
import { Flex } from "@/components/Layout/Flex";

import type { AdminOverrideField } from "@/features/core/messaging/services/client/overrideClient";

export type OverrideFieldMarksProps = {
  field: Pick<AdminOverrideField, "edited" | "codeChanged" | "unusable" | "editable">;
  /** 保存していない下書きがある */
  dirty?: boolean;
};

export function OverrideFieldMarks({ field, dirty = false }: OverrideFieldMarksProps) {
  return (
    <Flex align="center" gap="xs" wrap="wrap" data-slot="override-field-marks">
      {field.edited ? (
        <SoftBadge variant="info" size="sm">
          編集済み
        </SoftBadge>
      ) : null}
      {field.codeChanged ? (
        <SoftBadge variant="warning" size="sm">
          元の文言が更新されました
        </SoftBadge>
      ) : null}
      {field.unusable ? (
        <SoftBadge variant="destructive" size="sm">
          使えない(元の文言で送信)
        </SoftBadge>
      ) : null}
      {!field.editable ? (
        <SoftBadge variant="muted" size="sm">
          編集できなくなった項目
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
