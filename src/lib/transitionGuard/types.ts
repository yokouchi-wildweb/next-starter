/** トークン構造 */
export type TransitionToken = {
  /** ユニークID */
  id: string;
  /** 遷移先パス */
  targetPath: string;
  /** 有効期限（timestamp） */
  expiresAt: number;
  /** 発行日時（timestamp） */
  createdAt: number;
  /** 特定トークン用キー（例: "gacha:roll:123"） */
  key?: string;
};

/** トークン発行オプション */
export type IssueTokenOptions = {
  /** 特定トークンのキー（{domain}:{action}:{identifier} 形式推奨） */
  key?: string;
  /** 有効期限（ミリ秒）デフォルト5分 */
  ttl?: number;
};

/** ガード失敗時の挙動 */
export type GuardFailAction =
  | { action: "redirect"; path: string }
  | { action: "error"; message?: string }
  | { action: "notFound" }
  | { action: "none" };

/** ガード設定 */
export type TransitionGuardConfig = {
  /** 許可する遷移元URL（補助的、optional） */
  allowedReferers?: string[];
  /** トークン必須か（デフォルト: true） */
  requireToken?: boolean;
  /** 特定トークンのキー（指定時はkey一致も検証） */
  tokenKey?: string;
  /** ガード失敗時の挙動 */
  onFail: GuardFailAction;
  /** ガードを無効にする（開発時のデバッグ用） */
  disabled?: boolean;
};

/** ガード失敗理由 */
export type GuardFailReason =
  | "no_token"
  | "expired"
  | "path_mismatch"
  | "key_mismatch"
  | "invalid_referer";

/** ガード結果 */
export type GuardResult = {
  passed: boolean;
  reason?: GuardFailReason;
};

/** ガードフックの戻り値 */
export type UseTransitionGuardResult = {
  /** ガードステータス */
  status: "checking" | "passed" | "failed";
  /** チェック中かどうか */
  isChecking: boolean;
  /** 正規の遷移かどうか（トークン検証に成功したか） */
  isValidTransition: boolean;
};
