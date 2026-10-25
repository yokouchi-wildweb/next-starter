// src/app/admin/_layout/HeaderSlots.tsx

import type { ReactNode } from "react";

import {
  ADMIN_HEADER_TITLE_SLOT_ID,
  ADMIN_HEADER_CENTER_SLOT_ID,
  ADMIN_HEADER_RIGHT_SLOT_ID,
} from "@/components/AppFrames/constants";

type AdminHeaderSlotsProps = {
  /** 右側のまとまりの末尾(右の受け口の後ろ)に描く要素。既定の Header は DarkModeSwitch を渡す */
  readonly trailing?: ReactNode;
};

/**
 * 管理画面ヘッダーの受け口 3 つ(タイトル / 中央 / 右)を既定の並び・クラスでまとめて描く。
 * PageTitle placement="header" と AdminHeaderPortal はこの id を探して描き込む。
 * ヘッダーを差し替えるときは `<header id={APP_HEADER_ELEMENT_ID}>` の中でロゴ等の後にこれを描く(./README.md)
 */
export function AdminHeaderSlots({ trailing }: AdminHeaderSlotsProps) {
  return (
    <>
      {/* タイトルスロット: ロゴ右隣に配置（sm 以上で表示、モバイルではページ内フォールバック） */}
      <div
        id={ADMIN_HEADER_TITLE_SLOT_ID}
        className="hidden min-w-0 shrink items-center border-l border-border/40 pl-4 sm:flex"
      />

      {/* 中央: ポータルスロット */}
      <div
        id={ADMIN_HEADER_CENTER_SLOT_ID}
        className="flex min-w-0 flex-1 items-center justify-center"
      />

      {/* 右側: ポータルスロット + trailing */}
      <div className="flex shrink-0 items-center gap-3">
        <div id={ADMIN_HEADER_RIGHT_SLOT_ID} className="flex items-center gap-3" />
        {trailing}
      </div>
    </>
  );
}
