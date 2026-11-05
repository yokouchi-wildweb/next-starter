// src/app/admin/_layout/AdminHeaderContext.tsx

"use client";

import { createContext, useContext, type ReactNode } from "react";

import { AdminHeader, type AdminHeaderProps } from "./AdminHeader";

/**
 * AdminLayout の header の prop(fork のヘッダーの差し替え)が使われているか。
 * 使われている間は AdminLayout が差し替えのヘッダーを今の場所に描き、AdminPage は自分の行を描かない。
 * 指令 16 で AdminLayout の header の prop を AdminHeader の差し替えに置き換えるまでの一時の橋
 */
const AdminHeaderReplacedContext = createContext(false);

export function AdminHeaderReplacedProvider({ replaced, children }: { readonly replaced: boolean; readonly children: ReactNode }) {
  return <AdminHeaderReplacedContext.Provider value={replaced}>{children}</AdminHeaderReplacedContext.Provider>;
}

/** 固定の行の置き方(利用者の枠のヘッダーと同じ: 上端・全幅・header-layer。高さは AdminLayout の器が上の余白で空ける) */
const PAGE_HEADER_PLACEMENT = "fixed inset-x-0 top-0 header-layer";

/** AdminPage が描くヘッダーの行。AdminLayout のヘッダーが差し替えられている間は描かない */
export function AdminPageHeader(props: Omit<AdminHeaderProps, "className">) {
  const replaced = useContext(AdminHeaderReplacedContext);
  if (replaced) return null;
  return <AdminHeader {...props} className={PAGE_HEADER_PLACEMENT} />;
}
