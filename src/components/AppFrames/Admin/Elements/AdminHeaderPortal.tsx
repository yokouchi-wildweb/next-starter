// src/components/AppFrames/Admin/Elements/AdminHeaderPortal.tsx

"use client";

import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import {
  ADMIN_HEADER_CENTER_SLOT_ID,
  ADMIN_HEADER_RIGHT_SLOT_ID,
} from "@/components/AppFrames/constants";

type SlotType = "center" | "right";

const SLOT_ID_MAP: Record<SlotType, string> = {
  center: ADMIN_HEADER_CENTER_SLOT_ID,
  right: ADMIN_HEADER_RIGHT_SLOT_ID,
};

type Props = {
  /** 配置先スロット: "center"（中央）または "right"（右側） */
  slot: SlotType;
  children: ReactNode;
};

/**
 * 管理画面ヘッダーの中央または右側に要素を配置するためのポータル。
 *
 * @example
 * // ページタイトルを中央に表示
 * <AdminHeaderPortal slot="center">
 *   <h2 className="text-sm font-medium">ユーザー管理</h2>
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
