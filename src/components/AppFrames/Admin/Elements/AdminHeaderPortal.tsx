// src/components/AppFrames/Admin/Elements/AdminHeaderPortal.tsx

"use client";

import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import {
  ADMIN_HEADER_TITLE_SLOT_ID,
  ADMIN_HEADER_CENTER_SLOT_ID,
  ADMIN_HEADER_RIGHT_SLOT_ID,
} from "@/components/AppFrames/constants";

type SlotType = "title" | "center" | "right";

const SLOT_ID_MAP: Record<SlotType, string> = {
  title: ADMIN_HEADER_TITLE_SLOT_ID,
  center: ADMIN_HEADER_CENTER_SLOT_ID,
  right: ADMIN_HEADER_RIGHT_SLOT_ID,
};

type Props = {
  /**
   * 配置先スロット:
   * - "title": ロゴ右隣のタイトル専用スロット（sm 以上で表示）
   * - "center": 中央の汎用ポータル（flex-1 で広がる）
   * - "right": 右側の汎用ポータル（ダークモードスイッチの隣）
   */
  slot: SlotType;
  children: ReactNode;
};

/**
 * 管理画面ヘッダーのスロットに要素を配置するためのポータル。
 *
 * @example
 * // ページタイトルをロゴ右隣に表示（PageTitle の placement="header" 経由が推奨）
 * <AdminHeaderPortal slot="title">
 *   <h1>ユーザー管理</h1>
 * </AdminHeaderPortal>
 *
 * @example
 * // ウィジェットを中央に表示
 * <AdminHeaderPortal slot="center">
 *   <SearchBox />
 * </AdminHeaderPortal>
 *
 * @example
 * // アクションボタンを右側に表示
 * <AdminHeaderPortal slot="right">
 *   <Button size="sm">新規作成</Button>
 * </AdminHeaderPortal>
 */
export function AdminHeaderPortal({ slot, children }: Props) {
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const slotId = SLOT_ID_MAP[slot];
    const element = document.getElementById(slotId);
    setTargetElement(element);
  }, [slot]);

  if (!targetElement) return null;

  return createPortal(children, targetElement);
}
