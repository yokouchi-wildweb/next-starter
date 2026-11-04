// src/features/core/chatRoom/services/client/createRoom.test.ts
//
// クライアントのルーム作成が deletedAt: null を書くことの検査（Firebase 不要）。
// 管理側の一覧・検索・件数は deletedAt == null で絞るため、フィールドが無いとクライアントで作ったルームが出ない。
// (package.json に type: module が無いので tsx は CJS として読む → before() で import)
import { before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

type Operation = { type: string; ref: { path: string }; data: Record<string, unknown> };
const executed: Operation[][] = [];

const SERVER_TIMESTAMP = { __serverTimestamp: true };
// 裸の指定子だと CJS の require が別の解決先を読みモックが効かないので、解決したファイルの URL で差し替える
mock.module(pathToFileURL(require.resolve("firebase/firestore")).href, {
  namedExports: {
    arrayRemove: () => ({}),
    arrayUnion: () => ({}),
    collection: (_db: unknown, path: string) => ({ path }),
    deleteField: () => ({}),
    doc: (parent: unknown, path?: string, id?: string) =>
      id !== undefined ? { path: `${path}/${id}` } : { path: `${(parent as { path: string }).path}/auto` },
    orderBy: () => ({}),
    query: () => ({}),
    serverTimestamp: () => SERVER_TIMESTAMP,
    where: () => ({}),
  },
});
mock.module(pathToFileURL(require.resolve("./chatFirebase")).href, {
  namedExports: {
    ensureChatAuth: async () => {},
    getChatFirestore: () => ({}),
    subscribeAfterChatAuth: (start: () => () => void) => start(),
  },
});
mock.module("@/lib/firestore/client", {
  namedExports: {
    executeBatch: async (operations: Operation[]) => void executed.push(operations),
    queryDocs: async () => [],
    subscribeCollection: () => () => {},
    subscribeDoc: () => () => {},
    updateDoc: async () => {},
  },
});

let createRoomWithSystemMessage: typeof import("./firestoreClient").createRoomWithSystemMessage;
before(async () => {
  ({ createRoomWithSystemMessage } = await import("./firestoreClient"));
});

test("createRoomWithSystemMessage のルームは deletedAt: null を持ち、メッセージには足さない", async () => {
  await createRoomWithSystemMessage({
    roomId: "room-1",
    type: "direct",
    name: null,
    participants: ["u1", "u2"],
    participantPair: "u1_u2",
    senderId: "u1",
  } as never);

  const [operations] = executed;
  assert.equal(operations.length, 2);
  const [room, message] = operations;
  assert.ok(room.ref.path.endsWith("/room-1"));
  assert.equal(room.data.deletedAt, null);
  assert.ok(Object.prototype.hasOwnProperty.call(room.data, "deletedAt"));
  assert.equal(Object.prototype.hasOwnProperty.call(message.data, "deletedAt"), false);
});
