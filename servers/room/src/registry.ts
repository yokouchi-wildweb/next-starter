// servers/room/src/registry.ts
//
// 【下流編集点】namespace → ルーム定義の登録レジストリ (src/registry/ と同じ思想)。
// アップストリームは疎通確認用の sample-counter のみを出荷する。
//
// 登録手順:
//   1. ルームロジック (reducer) を src/features/<domain>/room/ に純粋関数として実装する
//      (純度制約は ESLint realtime-room/purity で強制される。Node/Next/DB import 禁止)
//   2. ここで import して namespace 名をキーに登録する
//
// 例:
//   import { raidRoomDefinition } from "@/features/gachaRaid/room/definition";
//   export const roomRegistry = { raid: raidRoomDefinition, ... };

import type { AnyRoomDefinition, RoomDefinition } from "@/lib/realtimeRoom/protocol";

// ---------------------------------------------------------------------------
// sample-counter: 疎通確認用のサンプルルーム (実装パターンの参照元)
// ---------------------------------------------------------------------------

type SampleCounterState = {
  count: number;
  lastActorId: string | null;
};

type SampleCounterAction =
  | { type: "increment"; payload?: { amount?: number } }
  | { type: "reset" }
  // schedule effect のリファレンス: delayMs 後に reset を自己 dispatch する予約 (server 専用)。
  // 純度維持のため現在時刻 nowMs は payload で渡す (reducer 内で Date.now() を呼ばない)
  | { type: "scheduleReset"; payload: { delayMs: number; nowMs: number } };

const sampleCounterDefinition: RoomDefinition<SampleCounterState, SampleCounterAction> = {
  createInitialState: () => ({ count: 0, lastActorId: null }),

  reducer: (state, action, ctx) => {
    switch (action.type) {
      case "increment": {
        const amount = action.payload?.amount ?? 1;
        const next = { count: state.count + amount, lastActorId: ctx.userId };
        // 節目で一過性イベントを配信する例 (状態には載せない)
        if (next.count % 10 === 0) {
          return {
            state: next,
            effects: [{ type: "event", event: "milestone", payload: { count: next.count } }],
          };
        }
        return { state: next };
      }
      case "reset":
        // server 経由のみ許可 (clientActions に載せていない)
        return { state: { count: 0, lastActorId: ctx.userId } };
      case "scheduleReset":
        // 状態は変えず、指定時刻に reset を予約する (単一スロット: 後の予約が前を置換)
        return {
          state,
          effects: [
            {
              type: "schedule",
              atMs: action.payload.nowMs + action.payload.delayMs,
              action: { type: "reset" },
            },
          ],
        };
      default:
        return { state };
    }
  },

  // increment のみブラウザから直接 dispatch 可 (reset / scheduleReset はサーバー専用)
  clientActions: ["increment"],

  // 状態pushの合流リファレンス: 100ms に最大1回 (leading + trailing、最終状態は必ず届く)。
  // 既定は 0 (dispatch 毎に即時 push)。高頻度ルームのみ設定する
  broadcastThrottleMs: 100,
};

// ---------------------------------------------------------------------------
// レジストリ本体
// ---------------------------------------------------------------------------

export const roomRegistry: Record<string, AnyRoomDefinition> = {
  "sample-counter": sampleCounterDefinition,
};
