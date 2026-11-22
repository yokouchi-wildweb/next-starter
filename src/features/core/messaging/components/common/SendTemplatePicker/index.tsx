// src/features/core/messaging/components/common/SendTemplatePicker/index.tsx
// 部品(props だけ): 送るモーダルのテンプレート(D110 D117 D118)。選んだ種別のテンプレートだけを並べる(呼び手が絞る)。
// - 読み込んでいない = レイアウトから書く形(今のレイアウトの名前、印「レイアウト」。レイアウトを選ぶ部品は指令 03)。「テンプレートを読み込む」で選ぶ小窓:
//   公開中のテンプレート(説明は版、D119)(SelectPopover、多ければ検索)、選ぶと onLoad(id)
// - 読み込んだ後: 名前と版、直した印(edited)、「別のテンプレートを読み込む」「テンプレートの読み込みを解除」(解除 = 初めのレイアウトに戻す。今の文はレイアウトが同じなら残る = hook)
// 専用の埋め込み情報の入力は SendVarInputs(このフォルダ)

"use client";

import { SoftBadge } from "@/components/Badge/SoftBadge";
import { Button } from "@/components/Button/Button";
import { Flex } from "@/components/Layout/Flex";
import { SelectPopover } from "@/components/Overlays/Popover";
import { Span } from "@/components/TextBlocks/Span";

export { SendVarInputs, type SendVarInputsProps } from "./SendVarInputs";

export type SendTemplatePickerProps = {
  /** 選べるテンプレート(選んだ種別の公開中の物) */
  templates: { id: string; name: string; currentVersion: number }[];
  /** 今のレイアウト(読み込んでいない時の出どころ。無ければ null = テンプレートを読み込まないと送れない) */
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
      emptyMessage="この種別のテンプレートはありません"
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
            レイアウト
          </SoftBadge>
          <Span size="sm" weight="semiBold">
            {blank.label}
          </Span>
        </>
      ) : (
        <Span size="sm" tone="muted">
          管理画面で選べるレイアウトが無いため、テンプレートを読み込んでください
        </Span>
      )}
      {chooser("テンプレートを読み込む")}
    </Flex>
  );
}
