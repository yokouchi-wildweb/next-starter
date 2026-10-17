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
 * @template P 動的セグメント(例: `{ slug: string }`)。無いルートは省略
 * @template S searchParams の形。省略時は未解釈のまま
 */
export type ScreenProps<
  P extends Record<string, string | string[]> = Record<string, never>,
  S extends ScreenSearchParams = ScreenSearchParams,
> = {
  params: Promise<P>;
  searchParams: Promise<S>;
};

/**
 * `pnpm test:screens` が検査するルートの 1 件。
 * 上流の一覧は src/lib/screens/screens.test.mjs の UPSTREAM_ROUTES、
 * 中間 Tier の fork が自分のルートを登録する場所は src/registry/screenRoutesRegistry.ts。
 */
export type ScreenRouteEntry = {
  /** ルートディレクトリ(リポジトリ相対。例: "src/app/(user)/(protected)/wallet/[slug]") */
  dir: string;
  /** `_screen/<screen>.tsx` のファイル名 = named export 名(例: "WalletBalanceScreen") */
  screen: string;
  /** loader のパス(リポジトリ相対)。ロジックの無いページは省略 */
  loader?: string;
  /**
   * このルートを所有するリポジトリ。git の origin URL に対する正規表現(文字列)。
   * 一致するリポジトリでだけ page.tsx の「1 行スイッチ」検査が走る。
   * 一致しない下流では page.tsx は下流所有なので検査しない(_screen と loader の検査は常に走る)
   */
  owner: string;
};
