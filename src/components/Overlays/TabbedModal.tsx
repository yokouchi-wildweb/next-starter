// src/components/Overlays/TabbedModal.tsx

"use client";

import type { ReactNode } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/_shadcn/tabs";
import { cn } from "@/lib/cn";

import Modal, { type ModalProps } from "./Modal";

export type TabbedModalTab = {
  value: string;
  label: ReactNode;
  content: ReactNode;
  disabled?: boolean;
  forceMount?: boolean;
  triggerClassName?: string;
  contentClassName?: string;
};

type TabsPresentationProps = {
  /**
   * Tabs.Root へ付与するクラス。レイアウト調整時に利用。
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

export type TabbedModalProps = Omit<ModalProps, "children" | "headerContent"> &
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
     * 非制御時の初期タブ。
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
  ...modalProps
}: TabbedModalProps) {
  if (!tabs.length) {
    return null;
  }

  const resolvedDefaultValue = defaultValue ?? tabs[0]!.value;
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
      value={value}
      defaultValue={value === undefined ? resolvedDefaultValue : undefined}
      onValueChange={onValueChange}
      className={cn("w-full", tabsClassName)}
    >
      <Modal
        {...modalProps}
        minHeight={minHeight}
        headerContent={tabList}
      >
        {tabs.map((tab) => (
          <TabsContent
            key={tab.value}
            value={tab.value}
            forceMount={tab.forceMount}
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
