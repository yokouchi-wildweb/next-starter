// src/app/(user)/demo/_data/demoPages.ts
// デモの一覧の型・カテゴリの定義と、組み立て。デモ本体の情報は各 route の _demo.ts(一覧 ../extensions/demoPages.ts は生成物)。
// デモを足す = route のフォルダに _demo.ts を置いて pnpm generate extensions。カテゴリの中はフォルダ名の順。

export type DemoCategoryKey =
  | "form"
  | "overlay"
  | "ui"
  | "media"
  | "auth"
  | "payment";

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
] as const;

export const demoHref = (page: Pick<DemoPage, "folder">) => `/demo/${page.folder}`;

/** isClosed の住所のデモを除く。上流の loader は gate.filter(demoPages, demoHref) を使う(fork の Screen から呼んでいる物のために残す) */
export const openDemoPages = (pages: readonly DemoPage[], isClosed: (href: string) => boolean): DemoPage[] =>
  pages.filter((page) => !isClosed(demoHref(page)));

export const groupDemoPagesByCategory = (pages: readonly DemoPage[]) =>
  DEMO_CATEGORIES.map((category) => ({
    ...category,
    pages: pages.filter((page) => page.category === category.key),
  })).filter((group) => group.pages.length > 0);
