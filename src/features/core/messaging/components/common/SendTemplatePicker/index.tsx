// src/features/core/messaging/components/common/SendTemplatePicker/index.tsx
// 部品(props だけ): 送るモーダルのテンプレートの呼び出し。選んで「呼び出す」と、今の公開版の文言が書く欄に写る(直して送れる)。
// 呼び出している間は名前と版を出し、「やめる」でその場で書く欄に戻る。門 messagingTemplates が閉なら入れ物が出さない

"use client";

import { useState } from "react";

import { SoftBadge } from "@/components/Badge";
import { Button } from "@/components/Form/Button";
import { SelectInput } from "@/components/Form/Input/Manual";
import { Flex } from "@/components/Layout/Flex";
import { Span } from "@/components/TextBlocks/Span";

export type SendTemplatePickerProps = {
  templates: { id: string; name: string; currentVersion: number }[];
  /** 呼び出しているテンプレート(無ければ null) */
  called: { id: string; name: string; version: number } | null;
  onCall: (templateId: string) => void;
  onClear: () => void;
};

export function SendTemplatePicker({ templates, called, onCall, onClear }: SendTemplatePickerProps) {
  const [picked, setPicked] = useState("");
  if (called) {
    return (
      <Flex align="center" gap="xs" wrap="wrap" data-slot="send-template-picker">
        <SoftBadge variant="info" size="sm">
          テンプレート
        </SoftBadge>
        <Span size="sm" weight="semiBold">
          {called.name}(v{called.version})
        </Span>
        <Button type="button" size="sm" variant="ghost" onClick={onClear}>
          やめてその場で書く
        </Button>
      </Flex>
    );
  }
  return (
    <Flex align="center" gap="xs" wrap="wrap" data-slot="send-template-picker">
      <SelectInput
        aria-label="テンプレート"
        value={picked}
        options={templates.map((item) => ({ value: item.id, label: `${item.name}(v${item.currentVersion})` }))}
        onChange={(v) => setPicked(v ? String(v) : "")}
        placeholder="テンプレートを選ぶ"
      />
      <Button type="button" size="sm" variant="outline" disabled={!picked} onClick={() => onCall(picked)}>
        呼び出す
      </Button>
    </Flex>
  );
}
