// src/app/admin/_layout/AdminOuterLayout.tsx

"use client";

import type { ReactNode } from "react";

import { AdminLayout } from "./AdminLayout";

/** @deprecated 旧 props 型の互換。AdminLayoutProps を使う(旧入口撤去の区切りで削除) */
export type AdminLayoutClientProps = {
  children: ReactNode;
  /** 追加のクラス名（invert等のスタイル制御用） */
  className?: string;
};

/** @deprecated 旧 export 名の互換。AdminLayout を使う(旧入口撤去の区切りで削除) */
export function AdminOuterLayout(props: AdminLayoutClientProps) {
  return <AdminLayout {...props} />;
}
