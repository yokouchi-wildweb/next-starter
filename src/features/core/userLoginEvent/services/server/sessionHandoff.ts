// src/features/core/userLoginEvent/services/server/sessionHandoff.ts
//
// 端末受け渡し (session handoff) 検出クエリ。すべて server-only。
//
// 「ユーザー A が明示ログアウトした直後、同一 IP (+ 同一 User-Agent) から
//  別ユーザー B がログイン / 新規登録した」列を user_login_events の self-join で拾う。
// 共有端末で複数アカウントを運用しているケースの最も強い列的証拠になる。
//
// 前提と限界:
// - 終端側は "logout" 行 (= 明示的なセッション終了: logout / pause / withdraw) のみ。
//   Cookie 失効やブラウザ閉鎖は記録されないため、その経路の受け渡しは検出できない。
// - 同一 Wi-Fi / CGNAT 配下の別人でも IP は一致する。requireSameUserAgent (既定 true)
//   で誤検出は減るが、同型端末の同一ブラウザ版では衝突し得る。結果は「参考証拠」であり
//   単独で断定材料にしないこと (deviceFingerprint.similarity と同じ扱い)。
// - index は既存の (ip, occurred_at) btree を使う。logout 行ごとに同一 IP かつ時間窓内の
//   開始側行を range scan するため追加 index は不要。

import { sql, type SQL } from "drizzle-orm";

import { db } from "@/lib/drizzle";

import { UserLoginEventTable } from "@/features/core/userLoginEvent/entities/drizzle";
import { UserTable } from "@/features/core/user/entities/drizzle";
import {
  DEFAULT_SESSION_HANDOFF_WINDOW_MINUTES,
  SESSION_END_EVENT_TYPES,
  SESSION_START_EVENT_TYPES,
} from "@/features/core/userLoginEvent/constants";

const T = UserLoginEventTable;

export type SessionStartEventType = (typeof SESSION_START_EVENT_TYPES)[number];

export type SessionHandoffRow = {
  /** セッションを終えた側 (logout 行の user) */
  fromUserId: string;
  /** 直後にセッションを開始した側 (login / signup 行の user) */
  toUserId: string;
  /** 一致した IP (netmask 無しのホスト表記) */
  ip: string;
  /** 終端側行の User-Agent。requireSameUserAgent=true なら開始側と同一 */
  userAgent: string | null;
  /** logout の occurred_at */
  endedAt: Date;
  /** login / signup の occurred_at */
  startedAt: Date;
  /** startedAt - endedAt (秒) */
  gapSeconds: number;
  /** 開始側イベント種別 */
  startedBy: SessionStartEventType;
};

export type SessionHandoffOptions = {
  /** 終了→開始の許容間隔 (分)。既定 DEFAULT_SESSION_HANDOFF_WINDOW_MINUTES (= 5) */
  windowMinutes?: number;
  /**
   * User-Agent の完全一致も要求するか。既定 true。
   * true のとき終端側 UA が null の行は候補にならない (null 同士の一致は認めない)。
   * false にすると IP のみで判定する (同一 Wi-Fi の別端末も拾うため誤検出が増える)。
   */
  requireSameUserAgent?: boolean;
  /** 両側ともデモユーザーでない行に限定するか。既定 true */
  excludeDemo?: boolean;
  /** 既定 50 */
  limit?: number;
};

type ResolvedOptions = Required<SessionHandoffOptions>;

function resolveOptions(options: SessionHandoffOptions): ResolvedOptions {
  return {
    windowMinutes: options.windowMinutes ?? DEFAULT_SESSION_HANDOFF_WINDOW_MINUTES,
    requireSameUserAgent: options.requireSameUserAgent ?? true,
    excludeDemo: options.excludeDemo ?? true,
    limit: options.limit ?? 50,
  };
}

/** 定数配列を SQL の IN リスト用リテラルへ (内部定数のみ。外部入力は渡さない) */
const startTypesList = sql.raw(SESSION_START_EVENT_TYPES.map((t) => `'${t}'`).join(", "));
const endTypesList = sql.raw(SESSION_END_EVENT_TYPES.map((t) => `'${t}'`).join(", "));

/**
 * 終端行 (e_out) と開始行 (e_in) のペアを列挙する SELECT を組み立てる。
 * `filter` は e_out / e_in のどちらを起点にするかを決める追加条件。
 */
function buildPairSelect(filter: SQL, opts: ResolvedOptions): SQL {
  return sql`
    SELECT
      e_out.user_id     AS from_user_id,
      e_in.user_id      AS to_user_id,
      host(e_out.ip)    AS ip,
      e_out.user_agent  AS user_agent,
      e_out.occurred_at AS ended_at,
      e_in.occurred_at  AS started_at,
      e_in.event_type   AS started_by
    FROM ${T} e_out
    JOIN ${T} e_in
      ON e_in.ip = e_out.ip
     AND e_in.user_id <> e_out.user_id
     AND e_in.event_type IN (${startTypesList})
     AND e_in.occurred_at >  e_out.occurred_at
     AND e_in.occurred_at <= e_out.occurred_at + make_interval(mins => ${opts.windowMinutes}::int)
     AND (
       ${opts.requireSameUserAgent}::boolean = false
       OR (e_out.user_agent IS NOT NULL AND e_in.user_agent = e_out.user_agent)
     )
    WHERE e_out.event_type IN (${endTypesList})
      AND ${filter}
  `;
}

type RawRow = {
  fromUserId: string;
  toUserId: string;
  ip: string;
  userAgent: string | null;
  endedAt: Date | string;
  startedAt: Date | string;
  gapSeconds: number;
  startedBy: SessionStartEventType;
};

/** ペア集合にデモ除外・整形・並び順・件数制限を掛けて実行する */
async function runHandoffQuery(pairs: SQL, opts: ResolvedOptions): Promise<SessionHandoffRow[]> {
  const rows = (await db.execute(sql`
    SELECT
      h.from_user_id AS "fromUserId",
      h.to_user_id   AS "toUserId",
      h.ip           AS "ip",
      h.user_agent   AS "userAgent",
      h.ended_at     AS "endedAt",
      h.started_at   AS "startedAt",
      EXTRACT(EPOCH FROM (h.started_at - h.ended_at))::int AS "gapSeconds",
      h.started_by   AS "startedBy"
    FROM (${pairs}) h
    JOIN ${UserTable} uf ON uf.id = h.from_user_id
    JOIN ${UserTable} ut ON ut.id = h.to_user_id
    WHERE (${opts.excludeDemo}::boolean = false OR (uf.is_demo = false AND ut.is_demo = false))
    ORDER BY h.ended_at DESC, h.started_at ASC
    LIMIT ${opts.limit}
  `)) as RawRow[];

  return rows.map((row) => ({
    fromUserId: row.fromUserId,
    toUserId: row.toUserId,
    ip: row.ip,
    userAgent: row.userAgent,
    endedAt: row.endedAt instanceof Date ? row.endedAt : new Date(row.endedAt),
    startedAt: row.startedAt instanceof Date ? row.startedAt : new Date(row.startedAt),
    gapSeconds: row.gapSeconds,
    startedBy: row.startedBy,
  }));
}

/**
 * 指定ユーザーが関与する端末受け渡しを返す (from / to どちら側でも該当)。
 *
 * - `fromUserId === userId` … このユーザーが終了した直後に別ユーザーが開始した (渡した側)
 * - `toUserId === userId`   … 別ユーザーが終了した直後にこのユーザーが開始した (受けた側)
 *
 * 2 方向を UNION ALL で結合する (OR で書くと両側の user_id index が使えないため)。
 * from = to は self-join 条件で除外済みなので重複は発生しない。
 */
export async function findSessionHandoffsByUser(
  userId: string,
  options: SessionHandoffOptions = {},
): Promise<SessionHandoffRow[]> {
  const opts = resolveOptions(options);
  const asFrom = buildPairSelect(sql`e_out.user_id = ${userId}::uuid`, opts);
  const asTo = buildPairSelect(sql`e_in.user_id = ${userId}::uuid`, opts);
  return runHandoffQuery(sql`${asFrom} UNION ALL ${asTo}`, opts);
}

/**
 * 指定 IP 上で発生した端末受け渡しを返す (管理画面の IP ドリルダウン用)。
 * `ip` は単一アドレス想定 ("203.0.113.10")。
 */
export async function findSessionHandoffsByIp(
  ip: string,
  options: SessionHandoffOptions = {},
): Promise<SessionHandoffRow[]> {
  const opts = resolveOptions(options);
  const pairs = buildPairSelect(sql`e_out.ip = ${ip}::inet`, opts);
  return runHandoffQuery(pairs, opts);
}
