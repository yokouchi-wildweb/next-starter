// src/features/core/messaging/components/common/SendTemplatePicker/index.tsx
// 部品(props だけ): 送るモーダルの「テンプレートから読み込む」(D47。任意)。押すと公開中のテンプレートを名前で並べた小窓
// (SelectPopover、多ければ検索)が開き、選ぶと onLoad(id)。読み込んだ後は名前と版、「別のテンプレートを読み込む」と「テンプレートを外す」
// (外しても今の文はその場で書いた文として残る = hook)。門 messagingTemplates が閉なら入れ物が出さない

"use client";

import { SoftBadge } from "@/components/Badge";
import { Button } from "@/components/Form/Button";
import { Flex } from "@/components/Layout/Flex";
import { SelectPopover } from "@/components/Overlays/Popover";
import { Span } from "@/components/TextBlocks/Span";

export type SendTemplatePickerProps = {
  templates: { id: string; name: string; currentVersion: number }[];
  /** 読み込んでいるテンプレート(無ければ null) */
  loaded: { id: string; name: string; version: number } | null;
  onLoad: (templateId: string) => void;
  onUnload: () => void;
};

/** 小窓に並べる件数がこれを超えたら検索の欄を出す */
const SEARCH_FROM = 8;

export function SendTemplatePicker({ templates, loaded, onLoad, onUnload }: SendTemplatePickerProps) {
  const chooser = (label: string) => (
    <SelectPopover
      trigger={
        <Button type="button" size="sm" variant="outline">
          {label}
        </Button>
      }
      title="テンプレートを選ぶ"
      options={templates.map((item) => ({ value: item.id, label: item.name, description: `v${item.currentVersion}` }))}
      value={loaded?.id}
      confirmLabel="読み込む"
      searchable={templates.length > SEARCH_FROM}
      searchPlaceholder="名前で探す"
      emptyMessage="公開中のテンプレートはありません"
      onConfirm={(value) => onLoad(value)}
    />
  );
  if (loaded) {
    return (
      <Flex align="center" gap="xs" wrap="wrap" data-slot="send-template-picker">
        <SoftBadge variant="info" size="sm">
          テンプレート
        </SoftBadge>
        <Span size="sm" weight="semiBold">
          {loaded.name}(v{loaded.version})
        </Span>
        {chooser("別のテンプレートを読み込む")}
        <Button type="button" size="sm" variant="ghost" onClick={onUnload}>
          テンプレートを外す
        </Button>
      </Flex>
    );
  }
  return (
    <Flex align="center" gap="xs" wrap="wrap" data-slot="send-template-picker">
      {chooser("テンプレートから読み込む")}
      <Span size="xs" tone="muted">
        (任意。カテゴリー・経路・文言・画像を写し、読み込んだ後も直せます)
      </Span>
    </Flex>
  );
}
