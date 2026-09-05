// src/components/Overlays/TabbedModal.tsx

"use client";

import { type ReactNode, useCallback, useRef, useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/_shadcn/tabs";
import { cn } from "@/lib/cn";

import Modal, { type ModalProps } from "./Modal";

export type TabbedModalTab = {
  value: string;
  label: ReactNode;
  content: ReactNode;
  /**
   * このタブがアクティブなときだけ表示するフッター（Modal の footer と同じ常時表示アクションバー）。
   * - 未指定（undefined）: モーダル全体の `footer` にフォールバック
   * - `null`: このタブではフッターを表示しない（フォールバックしない）
   */
  footer?: ReactNode;
  disabled?: boolean;
  forceMount?: boolean;
  triggerClassName?: string;
  contentClassName?: string;
};

type TabsPresentationProps = {
  /**
   * Tabs.Root へ付与するクラス。
   * Root は呼び出し元のツリーに `display: contents` で置かれレイアウトを持たないため、
   * 余白・幅などのレイアウト系クラスは効かない（data 属性用途などに限る）。
   */
  tabsClassName?: string;
  /**
   * TabsList（タブ見出し）へ付与するクラス。
   */
  tabListClassName?: string;
  /**
   * TabsTrigger に共通で付与するクラス。
   */
  tabTriggerClassName?: string;
  /**
   * TabsContent に共通で付与するクラス。
   */
  tabContentClassName?: string;
};

export type TabbedModalProps = Omit<ModalProps, "children" | "headerContent" | "bodyRef"> &
  TabsPresentationProps & {
    tabs: TabbedModalTab[];
    /**
     * タブリストを囲う nav の aria-label。
     */
    ariaLabel?: string;
    /**
     * 制御用 value。指定しない場合は defaultValue => 先頭タブの順で決定。
     */
    value?: string;
    /**
     * 非制御時の初期タブ。モーダルを開くたびにこの値へ戻る。
     */
    defaultValue?: string;
    /**
     * 制御 / 非制御共通で呼び出される変更通知。
     */
    onValueChange?: (value: string) => void;
  };

/**
 * モーダル内部で複数タブを切り替える UI。
 * 既存の Modal コンポーネントを包み、Tabs（Radix）でコンテンツを分割する。
 *
 * 構造メモ:
 * - Tabs.Root は Modal（ポータル）の外側に置くが `display: contents` にして呼び出し元の
 *   レイアウトに参加させない（旧実装は空の flex 子として Stack 等の gap を消費し、開閉で
 *   ページが揺れていた）。TabsList / TabsContent はポータル内でも React context で Root に届く。
 * - 閉じたときに null を返さない。Radix の閉じアニメーションとトリガーへのフォーカス復帰
 *   （onCloseAutoFocus）を Modal に任せる。
 * - 非制御時のアクティブタブは Modal を開くたびに defaultValue へ戻す（別レコードを開いたのに
 *   前回のタブが残るのを防ぐ）。
 */
export default function TabbedModal({
  tabs,
  value,
  defaultValue,
  onValueChange,
  ariaLabel = "モーダル内のタブ",
  tabsClassName,
  tabListClassName,
  tabTriggerClassName,
  tabContentClassName,
  minHeight = 360,
  open,
  footer,
  ...modalProps
}: TabbedModalProps) {
  const resolvedDefaultValue = defaultValue ?? tabs[0]?.value ?? "";

  // 非制御時のアクティブタブ。開くたびに defaultValue へ戻す（render 中の前回値比較パターン）
  const [internalValue, setInternalValue] = useState(resolvedDefaultValue);
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) setInternalValue(resolvedDefaultValue);
  }
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;

  // 本体スクロール領域は全タブで共有されるため、タブ切替時に先頭へ戻す
  // （戻さないと長いタブの途中位置のまま別タブが表示される）
  const bodyRef = useRef<HTMLDivElement>(null);
  const handleValueChange = useCallback(
    (next: string) => {
      if (!isControlled) setInternalValue(next);
      onValueChange?.(next);
      if (bodyRef.current) bodyRef.current.scrollTop = 0;
    },
    [isControlled, onValueChange],
  );

  if (!tabs.length) {
    return null;
  }

  // アクティブタブ固有の footer があればそれを、無ければモーダル全体の footer を表示する
  // （null 指定はそのタブでフッター無し。Modal は footer == null で非表示にする）
  const activeTab = tabs.find((tab) => tab.value === currentValue);
  const resolvedFooter = activeTab?.footer !== undefined ? activeTab.footer : footer;

  const tabList = (
    <nav aria-label={ariaLabel} className="mt-1 w-full">
      <TabsList
        className={cn(
          "!w-full justify-start overflow-x-auto overflow-y-hidden bg-muted/60 p-1.5 text-muted-foreground rounded-lg border border-border/60",
          tabListClassName,
        )}
      >
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            disabled={tab.disabled}
            className={cn(
              "flex-1 min-w-0 whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-sm",
              tabTriggerClassName,
              tab.triggerClassName,
            )}
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </nav>
  );

  return (
    <Tabs
      value={currentValue}
      onValueChange={handleValueChange}
      className={cn("contents", tabsClassName)}
    >
      <Modal
        {...modalProps}
        open={open}
        minHeight={minHeight}
        headerContent={tabList}
        footer={resolvedFooter}
        bodyRef={bodyRef}
      >
        {tabs.map((tab) => (
          <TabsContent
            key={tab.value}
            value={tab.value}
            forceMount={tab.forceMount ? true : undefined}
            className={cn(
              "w-full",
              tabContentClassName,
              tab.contentClassName,
              tab.forceMount && "data-[state=inactive]:hidden",
            )}
          >
            {tab.content}
          </TabsContent>
        ))}
      </Modal>
    </Tabs>
  );
}
