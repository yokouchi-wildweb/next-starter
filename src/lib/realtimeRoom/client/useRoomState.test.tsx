// useRoomState の再接続の検査(接続トークンの期限で Worker が閉じたら、待たずに新しいトークンで再接続する)。
// 接続の途中の片付け(unmount・部屋の替わり)の後に開かない・二重に開かない(D153)。
// 実行: pnpm test src/lib/realtimeRoom/client/useRoomState.test.tsx(tsx + node:test のモジュールモック + jsdom。WebSocket は偽物)
// (package.json に type: module が無いので tsx は CJS として読む = top-level await 不可 → before() で import)
import { after, before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement, useEffect } from "react";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.IS_REACT_ACT_ENVIRONMENT = true;

/** 手で開閉できる WebSocket。作られた順に並べる */
class FakeSocket {
  static OPEN = 1;
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly url: string) {
    sockets.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
  }
  open() {
    this.readyState = FakeSocket.OPEN;
    this.onopen?.();
  }
  serverClose(code: number) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
}
const sockets: FakeSocket[] = [];
g.WebSocket = FakeSocket;

let sessions = 0;
/** 接続情報の取得を止めておく(片付けの後に返る形を作る) */
let hold: Promise<void> | null = null;
mock.module("../config", {
  namedExports: {
    realtimeRoomConfig: { enabled: true, clientTokenTtlSeconds: 60, serviceTokenTtlSeconds: 60, reconnectBaseDelayMs: 1_000, reconnectMaxDelayMs: 15_000 },
  },
});
mock.module("./roomSessionClient", {
  namedExports: {
    roomSessionClient: {
      getSession: async (_ns: string, roomId: string) => {
        sessions += 1;
        const n = sessions;
        if (hold) await hold;
        return { token: `t${n}`, wsUrl: `wss://room.example/ns/${roomId}/ws`, protocolVersion: 1 };
      },
    },
  },
});

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let useRoomState: typeof import("./useRoomState").useRoomState;
let ROOM_CLOSE_CODES: typeof import("../node").ROOM_CLOSE_CODES;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ useRoomState } = await import("./useRoomState"));
  ({ ROOM_CLOSE_CODES } = await import("../node"));
});
after(() => dom.window.close());
beforeEach(() => {
  sockets.length = 0;
  sessions = 0;
  hold = null;
});

const flush = (ms = 0) => act(async () => new Promise((resolve) => setTimeout(resolve, ms)));

const mount = async (roomId = "r1") => {
  const latest: { status?: string } = {};
  const report = (status: string) => {
    latest.status = status;
  };
  // 描画中に外の変数を書き換えない(effect で外へ渡す)
  const Probe = ({ room }: { room: string }) => {
    const { status } = useRoomState("ns", room);
    useEffect(() => report(status), [status]);
    return null;
  };
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => root.render(createElement(Probe, { room: roomId })));
  await flush();
  return {
    latest,
    unmount: () => act(async () => root.unmount()),
    switchRoom: (room: string) => act(async () => root.render(createElement(Probe, { room }))),
  };
};

test("トークンの期限で閉じたら、待たずに新しいトークンで再接続する", async () => {
  const view = await mount();
  assert.equal(sockets.length, 1);
  assert.match(sockets[0].url, /token=t1$/);
  await act(async () => sockets[0].open());
  assert.equal(view.latest.status, "connected");

  await act(async () => sockets[0].serverClose(ROOM_CLOSE_CODES.tokenExpired));
  await flush();
  assert.equal(sessions, 2, "トークンを取り直す");
  assert.equal(sockets.length, 2);
  assert.match(sockets[1].url, /token=t2$/);
  await act(async () => sockets[1].open());
  assert.equal(view.latest.status, "connected");
  await view.unmount();
});

test("それ以外の切断はバックオフ(既定 1 秒)を待ってから再接続する", async () => {
  const view = await mount();
  await act(async () => sockets[0].open());
  await act(async () => sockets[0].serverClose(1006));
  await flush(50);
  assert.equal(sockets.length, 1, "すぐには繋ぎ直さない");
  assert.equal(view.latest.status, "connecting");
  await view.unmount();
});

test("接続情報の取得の途中で片付けたら、後で返っても接続を開かない", async () => {
  let release!: () => void;
  hold = new Promise((resolve) => (release = resolve));
  const view = await mount();
  assert.equal(sockets.length, 0);
  await view.unmount();
  await act(async () => release());
  await flush();
  assert.equal(sockets.length, 0, "片付けの後に開かない");
});

test("接続の途中で部屋が替わったら、前の部屋は開かず接続は 1 本", async () => {
  let release!: () => void;
  hold = new Promise((resolve) => (release = resolve));
  const view = await mount("r1");
  await view.switchRoom("r2");
  await act(async () => release());
  await flush();
  assert.equal(sockets.length, 1, "二重に開かない");
  assert.match(sockets[0].url, /\/r2\/ws\?/);
  await view.unmount();
  assert.equal(sockets[0].readyState, 3, "片付けで閉じる");
});
