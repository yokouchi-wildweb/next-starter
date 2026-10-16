// src/lib/siteTheme/types.ts
//
// サイトテーマ(ライト / ダーク)の既定値とエリア別ロックを表す型。
// 値の正は src/config/ui/site-theme.config.ts(下流所有)、既定値は ./defaults.ts(上流所有)。

/** エリアの既定モード。system は OS の配色設定(prefers-color-scheme)に追従する */
export type SiteThemeMode = "light" | "dark" | "system";

/** localStorage に保存される利用者の選択。null = 未選択 */
export type StoredThemePreference = "light" | "dark" | null;

/** パス接頭辞で定義するエリア(管理画面など) */
export type SiteThemeArea = {
  /** エリア識別子。`<html data-area>` にそのまま出力され、CSS の `[data-area="..."]` で参照できる */
  key: string;
  /**
   * このエリアに属するパスの接頭辞。セグメント境界で一致判定する
   * (`/admin` は `/admin` と `/admin/users` に一致し、`/administer` には一致しない)。
   * `/` は全パスに一致する。
   */
  match: readonly string[];
  /** 既定モード */
  mode: SiteThemeMode;
  /**
   * 利用者がモードを切り替えられるか。
   * false のエリアでは localStorage の保存値を一切参照しない(= 常に mode で固定)。
   */
  switchable: boolean;
};

/** どのエリアにも一致しないパスに適用される既定(通常はユーザー側) */
export type SiteThemeFallback = Omit<SiteThemeArea, "match">;

/** マージ済みの完全な設定 */
export type SiteThemeConfig = {
  /** 利用者の選択を保存する localStorage キー。全エリア共通 */
  storageKey: string;
  /** 先頭から順に照合し、最初に一致したエリアを採用する */
  areas: readonly SiteThemeArea[];
  fallback: SiteThemeFallback;
};

/**
 * 下流が書く差分。書いた項目だけ既定値を上書きする。
 * - areas: key が既定に存在すればその項目を部分更新(位置は維持)、無ければ末尾に追加
 * - fallback: 部分更新
 */
export type SiteThemeConfigInput = {
  storageKey?: string;
  areas?: readonly (Partial<SiteThemeArea> & { key: string })[];
  fallback?: Partial<SiteThemeFallback>;
};

/** パスから解決されたエリア(match は不要なので落とす) */
export type ResolvedSiteThemeArea = {
  key: string;
  mode: SiteThemeMode;
  switchable: boolean;
};

/** 解決結果 */
export type ResolvedSiteTheme = {
  area: ResolvedSiteThemeArea;
  isDark: boolean;
};

/** resolveSiteTheme への入力。SSR では stored=null / systemPrefersDark=false を渡す */
export type SiteThemeResolveInput = {
  pathname: string;
  stored: StoredThemePreference;
  systemPrefersDark: boolean;
};
