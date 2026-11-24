// src/domains/core/messaging/components/common/SendTemplatePicker/index.tsx
// 部品(props だけ): 送るモーダルのテンプレートの読み込み(任意の道具、D110 D117 D118 D195)。送信設定の一番上に置く(D223)。
// 呼び手は種別で絞らず公開中のテンプレート全部(種別・カテゴリーの表示名つき)を渡す。読み込むと種別・カテゴリーはそのテンプレートの物になる(hook)。
// レイアウトの選択は SendLayoutPicker(読み込まない = 選んだレイアウトから書く)。使えないレイアウトのテンプレートはサーバーが選択肢に出さない。
// - 読み込んでいない: 「テンプレートを読み込む」で選ぶ小窓: 種別のタブ(kinds、D224。開くたびに initialKind = 今の種別、無ければ最初のタブ)で
//   そのタブの種別のテンプレートだけを並べる(説明はカテゴリーと版、D119)(SelectPopover、多ければ検索 = タブの中で)、選ぶと onLoad(id)
// - 読み込んだ後: 名前と版、直した印(edited)、「別のテンプレートを読み込む」「テンプレートの読み込みを解除」(解除 = そのテンプレートのレイアウトへ戻す。今の文はレイアウトが同じなら残る = hook)
// 専用の埋め込み情報の入力は SendVarInputs(このフォルダ)

"use client";

import { useState } from "react";

import { SoftBadge } from "@/components/Badge/SoftBadge";
import { Button } from "@/components/Button/Button";
import { Flex } from "@/components/Layout/Flex";
import { StateTabs } from "@/components/Navigation/StateTabs";
import { SelectPopover } from "@/components/Overlays/Popover";
import { Span } from "@/components/TextBlocks/Span";

export { SendVarInputs, type SendVarInputsProps } from "./SendVarInputs";

export type SendTemplatePickerProps = {
  /** 選べるテンプレート(公開中の物を種別で絞らずに。kind = 小窓のタブ、categoryLabel = 説明に出すカテゴリーの表示名) */
  templates: { id: string; name: string; currentVersion: number; kind: string; categoryLabel: string }[];
  /** 小窓のタブ = 管理者が送れる種別(受け口の順) */
  kinds: readonly { key: string; label: string }[];
  /** 小窓を開いた時のタブ(今の送信の種別。空・タブに無ければ最初のタブ) */
  initialKind: string;
  /** 読み込んでいるテンプレート(無ければ null) */
  loaded: { id: string; name: string; version: number; edited: boolean } | null;
  onLoad: (templateId: string) => void;
  onUnload: () => void;
};

/** 小窓に並べる件数がこれを超えたら検索の欄を出す */
const SEARCH_FROM = 8;

export function SendTemplatePicker({ templates, kinds, initialKind, loaded, onLoad, onUnload }: SendTemplatePickerProps) {
  const firstTab = kinds.some((item) => item.key === initialKind) ? initialKind : (kinds[0]?.key ?? "");
  const [tab, setTab] = useState(firstTab);
  const tabTemplates = templates.filter((item) => item.kind === tab);
  const chooser = (label: string) => (
    <SelectPopover
      // 開くたびに今の種別のタブから
      onOpenChange={(open) => {
        if (open) setTab(firstTab);
      }}
      header={
        kinds.length > 0 ? (
          <StateTabs
            tabs={kinds.map((item) => ({ value: item.key, label: item.label }))}
            value={tab}
            onValueChange={setTab}
            variant="underline"
            size="sm"
            ariaLabel="種別"
          >
            {null}
          </StateTabs>
        ) : null
      }
      trigger={
        <Button type="button" size="sm" variant="outline" disabled={templates.length === 0}>
          {label}
        </Button>
      }
      title="テンプレートを選ぶ"
      options={tabTemplates.map((item) => ({ value: item.id, label: item.name, description: `${item.categoryLabel} · v${item.currentVersion}` }))}
      // 初めから値を渡す(undefined だと小窓の RadioGroup が非制御から制御に替わって警告が出る)。"" = まだ選んでいない
      value={loaded?.id ?? ""}
      confirmLabel="読み込む"
      searchable={tabTemplates.length > SEARCH_FROM}
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
      {chooser("テンプレートを読み込む")}
      {templates.length === 0 ? (
        <Span size="sm" tone="muted">
          公開中のテンプレートはありません
        </Span>
      ) : null}
    </Flex>
  );
}
