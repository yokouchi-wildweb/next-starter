// src/lib/audit/types.ts

/**
 * 監査ログを行ったアクター（操作者）の種別。
 * - system: バッチ・cron・移行スクリプトなど人間以外
 * - admin: 管理者によるユーザー / データへの介入
 * - user: 一般ユーザー本人による操作
 * - api_key: 外部システムからの API キー認証経由
 * - webhook: Webhook ドリブンの自動処理
 */
export const AUDIT_ACTOR_TYPES = ["system", "admin", "user", "api_key", "webhook"] as const;
export type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number];

/**
 * リクエスト単位の監査コンテキスト。
 * routeFactory が ALS に注入し、recorder が暗黙参照する。
 *
 * - actorId: 操作者の userId（system / 認証なしの場合は null）
 * - actorType: 操作者種別
 * - ip / userAgent: HTTP リクエストヘッダから抽出
 * - sessionId: 認証済みセッションの識別子（持っていない場合は null）
 * - requestId: リクエスト単位で発番される UUID（複数の audit を相関させるため）
 */
export type AuditContext = {
  actorId: string | null;
  actorType: AuditActorType;
  ip: string | null;
  userAgent: string | null;
  sessionId: string | null;
  requestId: string;
};

/**
 * `auditLogger.record` に渡す入力。
 * context は ALS から自動取得されるため指定不要。
 * 明示したい場合（バッチ、テスト、特殊用途）は context を明示できる。
 */
export type AuditRecordInput = {
  /** ターゲット種別（"user" / "post" / "order" 等のドメイン discriminator） */
  targetType: string;
  /** ターゲットの ID（uuid 以外も許容するため text で受ける） */
  targetId: string;
  /** action 名（規約: "<domain>.<entity>.<verb_past>"。例: "user.email.changed"） */
  action: string;
  /** 変更前のスナップショット（変更フィールドのみ推奨） */
  before?: Record<string, unknown> | null;
  /** 変更後のスナップショット（変更フィールドのみ推奨） */
  after?: Record<string, unknown> | null;
  /** ドメイン固有の追加情報 */
  metadata?: Record<string, unknown> | null;
  /** 任意のコメント（操作理由など） */
  reason?: string | null;
  /** ログの保持期間（日数）。省略時はドメイン側のデフォルトに従う */
  retentionDays?: number;
  /**
   * true の場合、書き込み失敗時に dead-letter に退避し例外を呑み込む（best-effort）。
   * 既定は false（strict）= 失敗時は呼び出し元の tx を巻き込んで rollback。
   */
  bestEffort?: boolean;
  /**
   * 明示的にコンテキストを渡したい場合に使用。
   * 通常は ALS から自動取得されるため省略する。
   */
  context?: AuditContext;
};

/**
 * 監査ログの内部表現（DB 永続化前の構造）。
 * recorder 実装が DB へ insert する際の入力。
 */
export type AuditLogPayload = {
  targetType: string;
  targetId: string;
  actorId: string | null;
  actorType: AuditActorType;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  context: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
  reason: string | null;
  retentionDays: number;
};
