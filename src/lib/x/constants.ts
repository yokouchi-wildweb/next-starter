// src/lib/x/constants.ts

/** OAuth 2.0 state を保存する cookie 名 */
export const X_OAUTH_STATE_COOKIE = "__x_oauth_state";

/** OAuth 2.0 code verifier を保存する cookie 名 */
export const X_OAUTH_CODE_VERIFIER_COOKIE = "__x_oauth_code_verifier";

/** Free Tier の月間投稿上限 */
export const X_FREE_TIER_MONTHLY_POST_LIMIT = 500;

/** Pay-Per-Use の投稿単価（USD） */
export const X_PAY_PER_USE_POST_COST = 0.01;

/** Pay-Per-Use の読み取り単価（USD） */
export const X_PAY_PER_USE_READ_COST = 0.005;

/** ツイートの最大文字数 */
export const X_MAX_TWEET_LENGTH = 280;

/** 1ツイートに添付可能な画像の最大数 */
export const X_MAX_IMAGES_PER_TWEET = 4;

/** OAuth 2.0 で利用可能なスコープ一覧 */
export const X_SCOPES = {
  /** ツイートの読み取り */
  TWEET_READ: "tweet.read",
  /** ツイートの書き込み */
  TWEET_WRITE: "tweet.write",
  /** ユーザー情報の読み取り */
  USERS_READ: "users.read",
  /** フォロー操作 */
  FOLLOWS_READ: "follows.read",
  FOLLOWS_WRITE: "follows.write",
  /** オフラインアクセス（リフレッシュトークン取得） */
  OFFLINE_ACCESS: "offline.access",
  /** いいね */
  LIKE_READ: "like.read",
  LIKE_WRITE: "like.write",
  /** ブックマーク */
  BOOKMARK_READ: "bookmark.read",
  BOOKMARK_WRITE: "bookmark.write",
  /** リスト */
  LIST_READ: "list.read",
  LIST_WRITE: "list.write",
  /** ブロック */
  BLOCK_READ: "block.read",
  BLOCK_WRITE: "block.write",
  /** ミュート */
  MUTE_READ: "mute.read",
  MUTE_WRITE: "mute.write",
  /** DM */
  DM_READ: "dm.read",
  DM_WRITE: "dm.write",
  /** スペース */
  SPACE_READ: "space.read",
} as const;
