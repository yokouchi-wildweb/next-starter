/**
 * ユーザー側の枠全体(UserLayout)の設定
 *
 * ★ プロジェクトごとにこのファイルを編集してカスタマイズしてください
 * 部品の差し替えは config ではなく UserLayout の slot で行う(src/app/(user)/_layout/README.md)
 */

import type { MainProps } from "@/components/Layout/Main";

// ============================================
// 背景設定
// ============================================

/** 背景画像のURL（例: imgPath("backgrounds/user-bg.jpg")）。空文字 = 画像なし（bg-background の単色） */
export const BACKGROUND_IMAGE_URL: string = "";

/** オーバーレイの色（任意のCSS色形式: "#000", "black", "rgb(0,0,0)"など） */
export const BACKGROUND_OVERLAY_COLOR: string = "#000";

/** オーバーレイの透明度（0-1） */
export const BACKGROUND_OVERLAY_OPACITY: number = 0;

// ============================================
// ページ幅設定
// ============================================

/**
 * UserPage の containerType の既定(fill / immersive 以外。ページが containerType を渡せばそちらが勝つ)。
 * 値は Layout/Main の containerType。アプリ全体で 1 つ(layout ごとの既定は持たない)
 */
export const USER_PAGE_CONTAINER_TYPE: NonNullable<MainProps["containerType"]> = "contentShell";
