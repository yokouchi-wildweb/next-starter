// src/features/core/messaging/components/common/SendTemplatePicker/index.tsx
// 部品(props だけ): 送るモーダルのテンプレート(D110 D117 D118)。選んだ種別のテンプレートだけを並べる(呼び手が絞る)。
// - 読み込んでいない = 種別の白紙(システムテンプレート、印つき)で書く形。「テンプレートを読み込む」で公開中のテンプレートを名前で選ぶ小窓
//   (SelectPopover、多ければ検索)、選ぶと onLoad(id)
// - 読み込んだ後: 名前と版、直した印(edited)、「別のテンプレートを読み込む」「テンプレートの読み込みを解除」(解除 = 白紙に戻す。今の文はひな形が同じなら残る = hook)
// 専用の埋め込み情報の入力は SendEmbeddedInputs(このフォルダ)

"use client";

import { SoftBadge } from "@/components/Badge";
import { Button } from "@/components/Form/Button";
import { Flex } from "@/components/Layout/Flex";
import { SelectPopover } from "@/components/Overlays/Popover";
import { Span } from "@/components/TextBlocks/Span";

export { SendEmbeddedInputs, type SendEmbeddedInputsProps } from "./SendEmbeddedInputs";

export type SendTemplatePickerProps = {
  /** 選べるテンプレート(選んだ種別の公開中の物) */
  templates: { id: string; name: string; currentVersion: number }[];
  /** 種別の白紙(読み込んでいない時の出どころ。無ければ null = テンプレートを読み込まないと送れない) */
  blank: { label: string } | null;
  /** 読み込んでいるテンプレート(無ければ null) */
  loaded: { id: string; name: string; version: number; edited: boolean } | null;
  onLoad: (templateId: string) => void;
  onUnload: () => void;
};

/** 小窓に並べる件数がこれを超えたら検索の欄を出す */
const SEARCH_FROM = 8;

export function SendTemplatePicker({ templates, blank, loaded, onLoad, onUnload }: SendTemplatePickerProps) {
  const chooser = (label: string) => (
    <SelectPopover
      trigger={
        <Button type="button" size="sm" variant="outline" disabled={templates.length === 0}>
          {label}
        </Button>
      }
      title="テンプレートを選ぶ"
      options={templates.map((item) => ({ value: item.id, label: item.name, description: `v${item.currentVersion}` }))}
      // 初めから値を渡す(undefined だと小窓の RadioGroup が非制御から制御に替わって警告が出る)。"" = まだ選んでいない
      value={loaded?.id ?? ""}
      confirmLabel="読み込む"
      searchable={templates.length > SEARCH_FROM}
      searchPlaceholder="名前で検索"
      emptyMessage="この種別の公開中のテンプレートはありません"
      onConfirm={(value) => {
        if (value) onLoad(value);
      }}
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
        {loaded.edited ? (
          <SoftBadge variant="warning" size="sm" data-slot="send-template-edited">
            直した文面
          </SoftBadge>
        ) : null}
        {chooser("別のテンプレートを読み込む")}
        <Button type="button" size="sm" variant="ghost" onClick={onUnload}>
          テンプレートの読み込みを解除
        </Button>
      </Flex>
    );
  }
  return (
    <Flex align="center" gap="xs" wrap="wrap" data-slot="send-template-picker">
      {blank ? (
        <>
          <SoftBadge variant="secondary" size="sm">
            システム
          </SoftBadge>
          <Span size="sm" weight="semiBold">
            {blank.label}
          </Span>
        </>
      ) : (
        <Span size="sm" tone="muted">
          この種別には白紙のテンプレートが無いため、テンプレートを読み込んでください
        </Span>
      )}
      {chooser("テンプレートを読み込む")}
    </Flex>
  );
}
