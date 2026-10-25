// src/app/admin/_layout/Sidebar/AdminSidebarFrame.tsx

"use client";

import { createContext, type ReactNode, useContext } from "react";

/** サイドバーの殻(PC の列 / SP のドロワー)が中身に渡す状態 */
export type AdminSidebarFrame = {
  /** どちらの殻の中か。"pc" = md 以上の列、"sp" = md 未満のドロワー */
  readonly placement: "pc" | "sp";
  /** 殻の幅(px)。リサイズで変わる */
  readonly width: number;
  /** SP のドロワーを閉じる(遷移・ログアウトの後に呼ぶ)。PC では何もしない */
  readonly close: () => void;
};

const AdminSidebarFrameContext = createContext<AdminSidebarFrame | null>(null);

/** 殻(PcSidebar / SpSidebar・Insane 版)が中身を包む Provider。DOM は足さない */
export function AdminSidebarFrameProvider({
  value,
  children,
}: {
  value: AdminSidebarFrame;
  children: ReactNode;
}) {
  return <AdminSidebarFrameContext.Provider value={value}>{children}</AdminSidebarFrameContext.Provider>;
}

/**
 * sidebar slot に渡した中身が、自分の殻の状態(placement・width・close)を読む。
 * 殻の外(slot を通さず直接描いた等)で呼ぶと例外
 */
export function useAdminSidebarFrame(): AdminSidebarFrame {
  const frame = useContext(AdminSidebarFrameContext);
  if (!frame) {
    throw new Error("useAdminSidebarFrame は管理画面のサイドバーの殻(sidebar slot)の中でだけ使える");
  }
  return frame;
}
