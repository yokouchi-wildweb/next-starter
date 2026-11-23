// src/app/admin/(protected)/_layout/Sidebar/SpSidebar.tsx

"use client";

import { type ReactNode } from "react";

import { Sheet } from "@/components/Overlays/Sheet";
import { AdminSidebarFrameProvider } from "@/app/admin/_layout/Sidebar/AdminSidebarFrame";

import { BaseSidebar } from "./BaseSidebar";

type SpSidebarProps = {
  width: number;
  isOpen: boolean;
  onClose?: () => void;
  /** 殻の中身。省略 = BaseSidebar */
  content?: ReactNode;
};

const noop = () => {};

/**
 * 開いた直後の自動フォーカスを板そのものへ向ける。
 * Radix の既定は板の中の最初のフォーカスできる要素(リンクは除く)= 最初のカテゴリーで、その onFocus が子メニューを開き、
 * 375px では左へ出る子メニューが背景を覆う。板(role=dialog、tabIndex -1)に置けば何も開かず、Tab で入れば今まで通り開く
 */
const focusPanel = (event: Event) => {
  event.preventDefault();
  (event.currentTarget as HTMLElement | null)?.focus();
};

/** SP のサイドバー: 右から出る板(Sheet)。印 admin-sidebar は板と背景の 2 つ(frame.css が隠す部位) */
export function SpSidebar({ width, isOpen, onClose, content }: SpSidebarProps) {
  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose?.();
      }}
      side="right"
      size={width}
      title="メニュー"
      titleSrOnly
      showCloseButton={false}
      onOpenAutoFocus={focusPanel}
      // 子メニューは板の左へはみ出して開く(submenuPlacement left)ので、板の本体で切らない(スクロールは BaseSidebar が持つ)
      scrollable={false}
      className="md:hidden border-l-0"
      overlayClassName="md:hidden"
      slot="admin-sidebar"
      overlaySlot="admin-sidebar"
    >
      <AdminSidebarFrameProvider value={{ placement: "sp", width, close: onClose ?? noop }}>
        {content === undefined ? (
          <BaseSidebar width={width} onNavigate={onClose} submenuPlacement="left" submenuVariant="compact" />
        ) : (
          content
        )}
      </AdminSidebarFrameProvider>
    </Sheet>
  );
}
