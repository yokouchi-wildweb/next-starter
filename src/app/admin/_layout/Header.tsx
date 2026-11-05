// src/app/admin/_layout/Header.tsx

"use client";

import { AdminHeader } from "./AdminHeader";

/**
 * 今までの既定のヘッダー(props なし・流れの中に置く形)。中身は ./AdminHeader の部品と同じ。
 * 既定の行は各ページの AdminPage が描くので、AdminLayout はもうこれを描かない。fork が AdminLayout の header の prop に
 * 渡していた場合のための互換の名前で、指令 17 で AdminHeader の差し替えに置き換えるときに外す
 */
export function Header() {
  return <AdminHeader />;
}
