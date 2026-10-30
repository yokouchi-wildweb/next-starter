// src/app/(user)/demo/_data/demoPages.ts
// デモの一覧の型・カテゴリの定義と、組み立て。デモ本体の情報は各 route の _demo.ts(一覧 ../extensions/demoPages.ts は生成物)。
// デモを足す = route のフォルダに _demo.ts を置いて pnpm extensions:generate。カテゴリの中はフォルダ名の順。

import { matchesPath } from "@/proxies/pathPattern.mjs";

export type DemoCategoryKey =
  | "form"
  | "overlay"
  | "ui"
  | "media"
  | "auth"
  | "payment"
  | "dev";

export type DemoCategory = {
  key: DemoCategoryKey;
  label: string;
};

/** _demo.ts の export const demo */
export type DemoEntry = {
  label: string;
  description: string;
  category: DemoCategoryKey;
};

export type DemoPage = DemoEntry & {
  /** /demo/ 配下のフォルダ名(生成器が付ける) */
  folder: string;
};

/** 一覧ページでの表示順 */
export const DEMO_CATEGORIES: readonly DemoCategory[] = [
  { key: "form", label: "フォーム" },
  { key: "overlay", label: "オーバーレイ" },
  { key: "ui", label: "UI 部品" },
  { key: "media", label: "メディア" },
  { key: "auth", label: "認証・計測" },
  { key: "payment", label: "決済" },
  { key: "dev", label: "開発ツール" },
] as const;

export const demoHref = (page: Pick<DemoPage, "folder">) => `/demo/${page.folder}`;

/** 閉じた機能の住所のデモを除く(機能を閉じる規則と同じ照合) */
export const openDemoPages = (
  pages: readonly DemoPage[],
  rules: readonly { enabled: () => boolean; pathPatterns: readonly string[] }[],
): DemoPage[] => {
  const closed = rules.filter((rule) => !rule.enabled()).flatMap((rule) => rule.pathPatterns);
  return pages.filter((page) => !closed.some((pattern) => matchesPath(demoHref(page), pattern)));
};

export const groupDemoPagesByCategory = (pages: readonly DemoPage[]) =>
  DEMO_CATEGORIES.map((category) => ({
    ...category,
    pages: pages.filter((page) => page.category === category.key),
  })).filter((group) => group.pages.length > 0);
