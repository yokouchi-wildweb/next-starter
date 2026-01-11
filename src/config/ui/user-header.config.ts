/**
 * ユーザー向けヘッダーの設定
 *
 * ★ プロジェクトごとにこのファイルを編集してカスタマイズしてください
 */

// ============================================
// コンポーネント設定
// ============================================

/**
 * ヘッダーコンポーネント
 * カスタム版を使用する場合は以下のようにコメントを切り替えてください：
 *
 * export { UserNavigation } from "@/components/AppFrames/User/Sections/HeaderCustom";
 */
export { UserNavigation } from "@/components/AppFrames/User/Sections/Header";

// ============================================
// ヘッダー表示設定
// ============================================

/** ヘッダー自体を表示するか */
export const HEADER_ENABLED = true;

/** ヘッダーのナビゲーションメニューを表示するか（falseでもヘッダー自体は表示される） */
export const HEADER_NAV_ENABLED = {
  /** スマホ版（640px未満）で表示するか */
  sp: true,
  /** PC版（640px以上）で表示するか */
  pc: true,
} as const;

// ============================================
// ロゴ設定
// ============================================

/** ロゴクリック時の遷移先 */
export const HEADER_LOGO_LINK = "/";

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
