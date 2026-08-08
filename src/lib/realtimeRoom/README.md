# lib/realtimeRoom — ルーム基盤 SDK (Next 側)

`servers/room` (ルーム権威サーバー) に接続するための SDK。
基盤の全体像・セットアップ・棲み分け基準は **`servers/room/README.md`** (一次ドキュメント) を参照。

**オプトイン (既定: 無効)**。`REALTIME_ROOM_CONFIG.enabled` + env が揃うまで全経路 fail-closed。

## 構成

```
protocol/   共有プロトコル (型・バージョン・トークン語彙)。servers/room と両方から参照される唯一の接点
server/     ServerService 用: createRoomClient / verifyRoomCallback / トークン署名
client/     ブラウザ用: useRoomState フック + roomSessionClient (ClientService)
```

ルート index は無い。**必ずサブパスで import する** ("use client" とサーバー専用コードの混在防止):

```ts
import { createRoomClient, verifyRoomCallback } from "@/lib/realtimeRoom/server";
import { useRoomState } from "@/lib/realtimeRoom/client";
import type { RoomDefinition } from "@/lib/realtimeRoom/protocol";
```

## サーバーから dispatch する (権威アクションの正規経路)

```ts
// src/features/<domain>/services/server/ 内 (ServerService)
import { createRoomClient } from "@/lib/realtimeRoom/server";
import type { RaidAction, RaidState } from "@/features/<domain>/room/definition";

const raidRooms = createRoomClient<RaidState, RaidAction>("raid");

export const attack = async (machineId: string, userId: string, damage: number) => {
  // 経済・確定処理は先に PG (権威) へ。ルームには表示・調整状態だけを流す
  const { state, stateVersion } = await raidRooms
    .room(machineId)
    .dispatch({ type: "attack", payload: { damage } }, { userId });
  return { state, stateVersion };
};
```

- `dispatch` はルーム上で直列実行され、適用後の状態が返る (閾値判定は reducer 内で行う)
- 無効時は `DomainError(503)`。プロトコル不一致は `DomainError(502)` で明示

## クライアントから購読する

```ts
"use client";
import { useRoomState } from "@/lib/realtimeRoom/client";

const RaidScreen = ({ machineId }: { machineId: string }) => {
  const { state, status, dispatch } = useRoomState<RaidState, RaidAction>("raid", machineId, {
    onEvent: (event, payload) => {
      // 一過性イベント (状態に載らないライブフィード等)
    },
  });

  // status: "disabled" | "connecting" | "connected" | "error"
  // dispatch: clientActions 許可リストの action のみ (高頻度・低権威アクション専用)
};
```

- 接続直後 + 毎変更で `state` が更新される。再接続 (トークン再取得込み) は自動
- 接続トークンは `GET /api/realtime-room/token` (要ログイン) が発行する

## callback (PG 永続化エスケープハッチ) を受ける

reducer の `{ type: "callback", path, payload }` effect はアプリ API に署名付き POST される。
受け口は `access: "custom"` + `verifyRoomCallback` で作る:

```ts
// src/app/api/<domain>/room-snapshot/route.ts
import { verifyRoomCallback } from "@/lib/realtimeRoom/server";
import { createApiRoute } from "@/lib/routeFactory";

export const POST = createApiRoute(
  { operation: "POST /api/<domain>/room-snapshot", operationType: "write", access: "custom" },
  async (req) => {
    const { ns, roomId } = await verifyRoomCallback(req); // 無署名は 401 (fail-closed)
    const { payload } = await req.json();
    // ServerService でスナップショットを PG に保存
  },
);
```

callback は fire-and-forget であり、**最終的な永続化の責任はアプリ側の設計に置く** (詳細: servers/room/README.md)。

## ルームロジックの置き場

reducer (`RoomDefinition`) は `src/features/<domain>/room/` に置く (純度制約 ESLint 付き)。
登録は `servers/room/src/registry.ts`。手順: `servers/room/README.md` の「新しいルームの追加手順」。
