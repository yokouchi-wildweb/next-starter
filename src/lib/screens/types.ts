// src/lib/screens/types.ts
//
// page 層(page.tsx → _screen/<Name>Screen.tsx)と loader が受け取る props の型。
// Next.js が page の default export に渡す props と同じ形(params / searchParams は Promise)。
// Next の生成型 PageProps<'/route'> は typegen 後にしか存在しないため、等価な薄い型をここに置く。
// searchParams は未解釈(string | string[] | undefined)のまま受け取り、解釈と検証は loader で行う。
// 手順と規則: src/lib/screens/README.md

/** 未解釈の searchParams */
export type ScreenSearchParams = Record<string, string | string[] | undefined>;

/**
 * Screen と loader の入力。
 * @template P 動的セグメント(例: `{ slug: string }`、optional catch-all なら `{ status?: string[] }`)。無いルートは省略
 * @template S searchParams の形。省略時は未解釈のまま
 */
export type ScreenProps<
  P extends Record<string, string | string[] | undefined> = Record<string, never>,
  S extends ScreenSearchParams = ScreenSearchParams,
> = {
  params: Promise<P>;
  searchParams: Promise<S>;
};

/**
 * `pnpm test:screens` の例外リストの 1 件(まだ page.tsx スイッチ化していないルート)。
 * 上流の未移行は src/lib/screens/screens.test.mjs の UPSTREAM_LEGACY_ROUTES、
 * fork の未移行は src/registry/screenRoutesRegistry.ts の FORK_LEGACY_ROUTES に書く。
 * 検査対象のルートは自動検出されるので、新しいページのための登録は不要。
 */
export type LegacyRouteEntry = {
  /** ルートディレクトリ(リポジトリ相対。例: "src/app/(user)/(protected)/mypage") */
  dir: string;
  /** まだ移行していない理由と予定 */
  reason: string;
};
