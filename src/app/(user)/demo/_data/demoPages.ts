// src/app/(user)/demo/_data/demoPages.ts
// デモページ一覧の単一ソース。/demo の一覧ページがここを参照する。
// デモページを追加・削除したらこのファイルだけを更新する。

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

export type DemoPage = {
  /** /demo/ 配下のパスセグメント */
  path: string;
  label: string;
  description: string;
  category: DemoCategoryKey;
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

export const DEMO_PAGES: readonly DemoPage[] = [
  // フォーム
  { path: "form-components", label: "Form Components", description: "フォームコンポーネント一覧", category: "form" },
  { path: "field-layout", label: "Field Layout", description: "フィールドレイアウトのデモ", category: "form" },
  { path: "media-input", label: "Media Input", description: "メディアアップロード", category: "form" },

  // オーバーレイ
  { path: "overlay", label: "Overlay", description: "モーダル・ダイアログ", category: "overlay" },
  { path: "popover", label: "Popover", description: "ポップオーバー", category: "overlay" },
  { path: "async-picker-modal", label: "Async Picker Modal", description: "大量マスタから選ぶモーダル", category: "overlay" },

  // UI 部品
  { path: "tables", label: "Tables", description: "テーブルコンポーネント", category: "ui" },
  { path: "sortable-list", label: "Sortable List", description: "並び替え可能なリスト", category: "ui" },
  { path: "status-badge", label: "Status Badge", description: "ステータスバッジ", category: "ui" },
  { path: "block-appearance", label: "Block Appearance", description: "ブロック要素の外観設定", category: "ui" },
  { path: "scroll-slider", label: "ScrollSlider", description: "横スクロール型スライダー", category: "ui" },
  { path: "fade-slider", label: "FadeSlider", description: "フェード型スライダー", category: "ui" },

  // メディア
  { path: "seamless-video", label: "Seamless Video", description: "fmp4のMSE継ぎ目なし連結再生", category: "media" },
  { path: "seamless-av", label: "Seamless A/V", description: "音声付きフラグメントの連結再生(映像MSE+音声WebAudio)", category: "media" },

  // 認証・計測
  { path: "google-popup", label: "Google Popup", description: "Google認証（ポップアップ）", category: "auth" },
  { path: "google-redirect", label: "Google Redirect", description: "Google認証（リダイレクト）", category: "auth" },
  { path: "fingerprint", label: "Fingerprint", description: "デバイス信号の収集とフォーム行動計測", category: "auth" },

  // 決済
  { path: "dummy-payment", label: "Dummy Payment", description: "ダミー決済フロー", category: "payment" },
  { path: "bank-transfer-vision", label: "Bank Transfer Vision", description: "AIによる銀行振込画像の事前判定", category: "payment" },

  // 開発ツール
  { path: "check-env", label: "Check Env", description: "環境変数の確認", category: "dev" },
] as const;

export const demoHref = (page: Pick<DemoPage, "path">) => `/demo/${page.path}`;

export const getDemoPagesByCategory = () =>
  DEMO_CATEGORIES.map((category) => ({
    ...category,
    pages: DEMO_PAGES.filter((page) => page.category === category.key),
  })).filter((group) => group.pages.length > 0);
