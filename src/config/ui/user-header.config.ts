/**
 * ユーザー向けヘッダーの設定
 *
 * ★ プロジェクトごとにこのファイルを編集してカスタマイズしてください
 */

// ============================================
// ヘッダー表示設定
// ============================================

/** ヘッダー自体を表示するか */
export const HEADER_ENABLED = true;

/** ヘッダーのナビゲーションメニューを表示するか（falseでもヘッダー自体は表示される） */
export const HEADER_NAV_ENABLED = true;

// ============================================
// ロゴ設定
// ============================================

/** ロゴクリック時の遷移先 */
export const HEADER_LOGO_LINK = "/";

/**
 * ロゴ画像のURL設定
 * - 未設定（null）の場合、もう一方のモードの画像をフォールバックとして使用
 * - 両方未設定の場合はテキストロゴを表示
 */
export const HEADER_LOGO = {
  /** ライトモード用のロゴ画像URL */
  light: null as string | null,
  /** ダークモード用のロゴ画像URL */
  dark: null as string | null,
} as const;

/**
 * テキストロゴ設定（画像ロゴが未設定の場合に使用）
 */
export const HEADER_TEXT_LOGO = {
  /** ロゴの短縮テキスト（アイコン部分） */
  short: "UX",
  /** ブランド名 */
  name: "Experience Demo",
} as const;

// ============================================
// メニューアイテム設定
// ============================================

/** メニューアイテムの型（リンク用） */
export type HeaderMenuItem = {
  readonly key: string;
  readonly label: string;
  readonly href: string;
};

/** 認証済みユーザー用メニュー（ログアウト以外） */
export const AUTHENTICATED_MENU_ITEMS: HeaderMenuItem[] = [
  { key: "home", label: "ホーム", href: "/" },
  { key: "service", label: "サービス", href: "/services" },
  { key: "mypage", label: "マイページ", href: "/mypage" },
];

/** 未認証ユーザー用メニュー */
export const GUEST_MENU_ITEMS: HeaderMenuItem[] = [
  { key: "home", label: "ホーム", href: "/" },
  { key: "service", label: "サービス", href: "/services" },
  { key: "login", label: "ログイン", href: "/login" },
  { key: "signup", label: "会員登録", href: "/signup" },
];

// ============================================
// ログアウト設定
// ============================================

/** ログアウトボタンを表示するか（認証済みユーザーのみ対象） */
export const SHOW_LOGOUT_BUTTON = true;

/** ログアウトボタンのラベル */
export const LOGOUT_LABEL = "ログアウト";

/** ログアウト後のリダイレクト先 */
export const LOGOUT_REDIRECT_TO = "/login";
