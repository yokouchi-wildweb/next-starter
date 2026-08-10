// src/lib/realtimeRoom/protocol/types.ts
//
// realtimeRoom の共有型定義。
// Next.js アプリ (src/lib/realtimeRoom) と servers/room (Cloudflare Workers) の両方から
// 参照される「唯一の接点」。純粋な型のみを置くこと (Node/Next/DB import 禁止)。

/** ルーム状態の基底型 (JSON シリアライズ可能なオブジェクト) */
export type RoomStateBase = Record<string, unknown>;

/** ルームアクションの基底型 */
export type RoomActionBase = {
  type: string;
  payload?: unknown;
};

/** reducer 実行時のアクター情報 (認可判断・記録用) */
export type RoomActorContext = {
  /** server = Next サーバー経由 (無制限) | client = ブラウザ WebSocket 直接 (許可リスト制) */
  actorType: "server" | "client";
  /** client の場合はトークン subject のユーザーID。server の場合は代行ユーザーID または null */
  userId: string | null;
};

/**
 * reducer が返す副作用。
 * - event: 状態に載せない一過性ブロードキャスト (ライブフィード等)。全購読者に配信される。
 *   状態pushと違い broadcastThrottleMs の合流対象にならない (ワンショット演出トリガー用)
 * - callback: アプリ側 API への署名付き POST (PG 永続化のエスケープハッチ)。
 *   path はアプリ側の相対パス (例: "/api/raid/snapshot")。検証は verifyRoomCallbackToken で行う
 * - schedule: 指定時刻に action を自己 dispatch する予約 (Durable Object alarm)。
 *   時間駆動の状態遷移 (バフ失効・カウントダウン・ラウンドタイマー等) 用。
 *   通常の dispatch と同じ直列化・永続化・配信・effects 経路で actorType:"server", userId:null として実行される。
 *   ルームにつき単一スロット (後の schedule が前の予約を置換)。action: null で予約クリア。
 *   予約は storage 永続 (hibernation/eviction を跨いで発火する)。発火は at-most-once 相当なので、
 *   厳密性が必要な失効は reducer 側の遅延評価 (次 dispatch で nowMs 判定) を安全網として併用すること。
 *   atMs は純度維持のため action payload から計算する (reducer 内で Date.now() を呼ばない)
 */
export type RoomEffect =
  | { type: "event"; event: string; payload: unknown }
  | { type: "callback"; path: string; payload: unknown }
  | { type: "schedule"; atMs: number; action: RoomActionBase | null };

/** reducer の戻り値。state は新しい状態 (イミュータブル推奨) */
export type RoomReducerResult<S extends RoomStateBase> = {
  state: S;
  effects?: RoomEffect[];
};

/**
 * ルームロジックの本体。純粋関数であること (I/O・乱数・現在時刻の直接参照は禁止。
 * 時刻が必要なアクションは payload に載せて渡す)。ルーム単位で直列実行が保証される。
 */
export type RoomReducer<S extends RoomStateBase, A extends RoomActionBase> = (
  state: S,
  action: A,
  ctx: RoomActorContext,
) => RoomReducerResult<S>;

/**
 * namespace 1 つ分のルーム定義。servers/room/src/registry.ts に登録する。
 * 実装は src/features/<domain>/room/ に置く (純度制約は ESLint で強制される)。
 */
export type RoomDefinition<
  S extends RoomStateBase = RoomStateBase,
  A extends RoomActionBase = RoomActionBase,
> = {
  /** ルーム初回アクセス時の初期状態を生成する */
  createInitialState: (roomId: string) => S;
  /** ルームロジック本体 */
  reducer: RoomReducer<S, A>;
  /**
   * ブラウザ (WebSocket) からの直接 dispatch を許可する action.type の許可リスト。
   * 省略時は全拒否 (fail-closed)。経済・権威性が絡むアクションはここに載せず、
   * 必ず Next サーバー経由 (createRoomClient) にすること。
   */
  clientActions?: readonly string[];
  /**
   * 状態ブロードキャストの合流ウィンドウ (ミリ秒)。省略/0 = dispatch 毎に即時 push (従来動作)。
   * 高頻度ルームで「N ms に最大1回」に間引く (leading + trailing edge、最終状態は必ず配信される)。
   * 状態メッセージはスナップショットなので中間フレームの間引きは無損失。
   * 接続時の初期 push・event effect・dispatch HTTP レスポンスは対象外 (常に即時)
   */
  broadcastThrottleMs?: number;
};

/**
 * レジストリ格納用の型消去済みルーム定義。
 * 個別の RoomDefinition<S, A> をキャストなしで代入できる (パラメータ反変・戻り値共変)。
 * ※ 状態型は type エイリアスで定義すること (interface は Record への暗黙 index signature を持たない)
 */
export type AnyRoomDefinition = {
  createInitialState: (roomId: string) => RoomStateBase;
  reducer: (state: never, action: never, ctx: RoomActorContext) => RoomReducerResult<RoomStateBase>;
  clientActions?: readonly string[];
  broadcastThrottleMs?: number;
};

// ---------------------------------------------------------------------------
// WebSocket メッセージ (Worker ⇄ ブラウザ)
// ---------------------------------------------------------------------------

/** Worker → ブラウザ */
export type RoomServerMessage<S extends RoomStateBase = RoomStateBase> =
  | {
      v: number;
      type: "state";
      /** 状態の単調増加バージョン (順序保証・デバッグ用) */
      stateVersion: number;
      state: S;
    }
  | { v: number; type: "event"; event: string; payload: unknown }
  | { v: number; type: "error"; code: string; message: string };

/** ブラウザ → Worker (clientActions 許可リストに載る action のみ受理される) */
export type RoomClientMessage<A extends RoomActionBase = RoomActionBase> = {
  v: number;
  type: "dispatch";
  action: A;
};

// ---------------------------------------------------------------------------
// HTTP レスポンス (Worker → Next サーバー)
// ---------------------------------------------------------------------------

/** POST /rooms/:ns/:id/dispatch のレスポンス */
export type RoomDispatchResponse<S extends RoomStateBase = RoomStateBase> = {
  v: number;
  stateVersion: number;
  state: S;
};

/** GET /rooms/:ns/:id/state のレスポンス */
export type RoomStateResponse<S extends RoomStateBase = RoomStateBase> = {
  v: number;
  stateVersion: number;
  state: S;
};

// ---------------------------------------------------------------------------
// トークンクレーム (jose HS256 / REALTIME_ROOM_AUTH_SECRET 共有鍵)
// ---------------------------------------------------------------------------

/** kind ごとの追加クレーム。標準クレーム (sub/exp/iat) は jose 側で扱う */
export type RoomTokenClaims = {
  kind: "room_client" | "room_server" | "room_callback";
  /** room_client / room_callback で必須: 対象 namespace */
  ns?: string;
  /** room_client / room_callback で必須: 対象ルームID */
  roomId?: string;
};
