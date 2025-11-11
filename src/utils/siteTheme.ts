// src/utils/siteTheme.ts

/**
 * ユーザーのテーマ設定を初期化するための関数
 * - localStorageに保存されたテーマがあればそれを使用
 * - なければOSの設定（prefers-color-scheme）を参照
 *
 * @returns boolean - ダークモードかどうか（true: dark, false: light）
 */
export const getInitialTheme = (): boolean => {
  // SSR環境など、windowが使えない場合はデフォルトfalse（light）
  if (typeof window === "undefined") {
    return false;
  }

  const stored = localStorage.getItem("theme");

  // 保存されたテーマが "dark" の場合
  if (stored === "dark") return true;

  // 保存されたテーマが "light" の場合
  if (stored === "light") return false;

  // 保存がない場合は、現在のDOMやOSの設定を参照
  if (document.documentElement.classList.contains("dark")) return true;

  return window.matchMedia("(prefers-color-scheme: dark)").matches;
};

/**
 * テーマに応じてDOMとlocalStorageを更新する
 * - <html> 要素に `dark` クラスを追加/削除
 * - localStorage に "dark" または "light" を保存
 *
 * @param isDark boolean - ダークモードを有効にするかどうか
 */
export const applyTheme = (isDark: boolean) => {
  if (isDark) {
    // ダークモードを有効化：クラス追加＋localStorage更新
    document.documentElement.classList.add("dark");
    localStorage.setItem("theme", "dark");
  } else {
    // ライトモードに変更：クラス削除＋localStorage更新
    document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", "light");
  }
};
