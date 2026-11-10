// src/lib/unsavedGuard/guard.test.ts — pnpm test src/lib/unsavedGuard/guard.test.ts
// 守りの本体(createUnsavedGuard)を DOM の道具なしの偽物で確かめる。実際のブラウザの 4 経路は tests/e2e/unsavedGuard/unsavedGuard.spec.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { NAVIGATION_PORT_ATTR, SENTINEL_KEY, SENTINEL_REMOVAL_TIMEOUT_MS, createTaskTracker, createUnsavedGuard, pickConfirmReason } from "./guard";
import type { LeaveRequest } from "./types";

type Fn = (event: never) => void;

function fakeEnv() {
  const listeners = new Map<string, Fn>();
  const docListeners = new Map<string, Fn>();
  const pushed: unknown[] = [];
  let backs = 0;
  const gos: number[] = [];
  const win = {
    addEventListener: (type: string, fn: Fn) => listeners.set(type, fn),
    removeEventListener: (type: string) => listeners.delete(type),
    history: {
      state: { __NA: true } as Record<string, unknown> | null,
      pushState(state: unknown) {
        pushed.push(state);
        win.history.state = state as Record<string, unknown>;
      },
      back: () => (backs += 1),
      go: (delta: number) => gos.push(delta),
    },
    location: { href: "http://x.test/form", origin: "http://x.test", pathname: "/form", search: "" },
  };
  const doc = { addEventListener: (type: string, fn: Fn) => docListeners.set(type, fn), removeEventListener: (type: string) => docListeners.delete(type) };
  return { env: { win, doc }, listeners, docListeners, pushed, backs: () => backs, gos };
}

function setup(answer: boolean) {
  const fake = fakeEnv();
  const asked: LeaveRequest[] = [];
  const moves: string[] = [];
  const router = {
    push: (href: string) => moves.push(`push ${href}`),
    replace: (href: string) => moves.push(`replace ${href}`),
    back: () => moves.push("back"),
    forward: () => moves.push("forward"),
  };
  const guard = createUnsavedGuard({
    confirm: (request) => {
      asked.push(request);
      return Promise.resolve(answer);
    },
    env: () => fake.env as never,
    router: () => router,
  });
  return { guard, fake, asked, moves };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

/** 番兵を外す history.back が着いた(偽物の back は state を動かさないので、前のページの state にして popstate を出す) */
function landBack(fake: ReturnType<typeof fakeEnv>) {
  fake.env.win.history.state = { __NA: true };
  (fake.listeners.get("popstate") as unknown as () => void)();
}

test("編集済みでなければ聞かずに進み、何も付けない", async () => {
  const { guard, fake, asked, moves } = setup(true);
  await guard.request({ kind: "push", href: "/a" }, () => moves.push("go"));
  assert.deepEqual(moves, ["go"]);
  assert.deepEqual(asked, []);
  assert.equal(fake.listeners.size, 0);
  assert.equal(guard.judgeLink("/a", { replace: false, scroll: true }), undefined);
});

test("編集済みになると番兵を 1 つ積み(Next の state を残す)、beforeunload・popstate・click(capture)を付ける。外すと外す", () => {
  const { guard, fake } = setup(true);
  const source = guard.createSource();
  source.set(true);
  assert.equal(fake.pushed.length, 1);
  const sentinel = fake.pushed[0] as Record<string, unknown>;
  assert.equal(sentinel.__NA, true, "Next の state を残す");
  assert.equal(typeof sentinel[SENTINEL_KEY], "string", "印はこの守りの値");
  assert.deepEqual([...fake.listeners.keys()].sort(), ["beforeunload", "popstate"]);
  assert.deepEqual([...fake.docListeners.keys()], ["click"]);
  source.set(true);
  assert.equal(fake.pushed.length, 1, "番兵は 1 つだけ");
  source.dispose();
  assert.deepEqual([...fake.listeners.keys()], ["popstate"], "番兵を外す途中は popstate だけ聞く");
  assert.equal(fake.docListeners.size, 0);
  landBack(fake);
  assert.equal(fake.listeners.size, 0);
});

test("router: 留まるなら進まない、移るなら進み、移動が終わるまで二度と聞かない", async () => {
  const stay = setup(false);
  stay.guard.createSource().set(true);
  assert.equal(await stay.guard.request({ kind: "push", href: "/a" }, () => stay.moves.push("go")), false);
  assert.deepEqual(stay.moves, []);
  assert.deepEqual(stay.asked, [{ kind: "push", href: "/a", reasons: ["unsaved"] }]);

  const leave = setup(true);
  leave.guard.createSource().set(true);
  await leave.guard.request({ kind: "back" }, () => leave.moves.push("back"));
  assert.deepEqual(leave.moves, ["back"]);
  await leave.guard.request({ kind: "push", href: "/b" }, () => leave.moves.push("push /b"));
  assert.equal(leave.asked.length, 1, "移ると決めた後は聞かない");
  assert.equal(leave.guard.isDirty(), false);
  leave.guard.navigated();
  assert.equal(leave.guard.isDirty(), true, "住所が変わってもフォームが残っていればまた守る");
});

test("Link の判定: 止めて聞き、移るなら元の href へ(replace / scroll も保つ)", async () => {
  const { guard, asked, moves } = setup(true);
  guard.createSource().set(true);
  let prevented = 0;
  guard.judgeLink("/t", { replace: true, scroll: false })?.({ preventDefault: () => (prevented += 1) });
  await tick();
  assert.equal(prevented, 1);
  assert.deepEqual(asked, [{ kind: "link", href: "/t", reasons: ["unsaved"] }]);
  assert.deepEqual(moves, ["replace /t"]);
});

test("素の <a>: 同じオリジンの別のページだけ止める(棚の Link の <a>・別のオリジン・同じページ・修飾キー・別のタブは通す)", async () => {
  const { guard, fake, asked, moves } = setup(true);
  guard.createSource().set(true);
  const click = fake.docListeners.get("click") as unknown as (event: object) => void;
  const anchor = (href: string, attrs: Record<string, string> = {}, target?: string) => ({
    href,
    target,
    hasAttribute: (name: string) => name in attrs,
  });
  const fire = (a: object, extra: object = {}) => {
    let prevented = false;
    click({ defaultPrevented: false, button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, target: { closest: () => a }, preventDefault: () => (prevented = true), stopPropagation: () => {}, ...extra });
    return prevented;
  };
  assert.equal(fire(anchor("http://x.test/other?q=1")), true);
  await tick();
  assert.deepEqual(asked, [{ kind: "anchor", href: "/other?q=1", reasons: ["unsaved"] }]);
  assert.deepEqual(moves, ["push /other?q=1"]);
  const { guard: g2, fake: f2 } = setup(true);
  g2.createSource().set(true);
  const click2 = f2.docListeners.get("click") as unknown as (event: object) => void;
  const fire2 = (a: object, extra: object = {}) => {
    let prevented = false;
    click2({ defaultPrevented: false, button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, target: { closest: () => a }, preventDefault: () => (prevented = true), stopPropagation: () => {}, ...extra });
    return prevented;
  };
  assert.equal(fire2(anchor("http://x.test/other", { [NAVIGATION_PORT_ATTR]: "" })), false, "棚の Link は onNavigate の判定が受ける");
  assert.equal(fire2(anchor("https://elsewhere.test/")), false, "別のオリジンは beforeunload");
  assert.equal(fire2(anchor("http://x.test/form#part")), false, "同じページの中");
  assert.equal(fire2(anchor("http://x.test/other"), { metaKey: true }), false);
  assert.equal(fire2(anchor("http://x.test/other", {}, "_blank")), false);
});

test("戻る / 進む(popstate): 留まるなら番兵を積み直し、移るなら番兵の先へもう 1 つ戻る", async () => {
  const stay = setup(false);
  stay.guard.createSource().set(true);
  stay.fake.env.win.history.state = { __NA: true };
  (stay.fake.listeners.get("popstate") as unknown as () => void)();
  await tick();
  assert.equal(stay.fake.pushed.length, 2, "積み直す");
  assert.deepEqual(stay.asked, [{ kind: "popstate", reasons: ["unsaved"] }]);

  const leave = setup(true);
  leave.guard.createSource().set(true);
  (leave.fake.listeners.get("popstate") as unknown as () => void)();
  await tick();
  assert.equal(leave.fake.backs(), 1);
  assert.equal(leave.fake.listeners.size, 0, "移ると決めたら外す");
});

test("beforeunload: 編集済みの間だけブラウザの確認を出す", () => {
  const { guard, fake } = setup(true);
  guard.createSource().set(true);
  const event = { prevented: false, returnValue: undefined as unknown, preventDefault() {
    this.prevented = true;
  } };
  (fake.listeners.get("beforeunload") as unknown as (e: typeof event) => void)(event);
  assert.equal(event.prevented, true);
  assert.equal(event.returnValue, "");
});

test("元が複数: どれか 1 つでも編集済みなら守り、全部が外れたら外す", () => {
  const { guard } = setup(true);
  const a = guard.createSource();
  const b = guard.createSource();
  a.set(true);
  b.set(true);
  a.set(false);
  assert.equal(guard.isDirty(), true);
  b.dispose();
  assert.equal(guard.isDirty(), false);
});

test("router.back の移る: 今が番兵の履歴なら番兵を飛ばして 2 つ戻る、そうでなければ素の back", () => {
  const { guard, fake } = setup(true);
  guard.createSource().set(true);
  const raw: string[] = [];
  guard.back(() => raw.push("back"));
  assert.deepEqual(fake.gos, [-2]);
  fake.env.win.history.state = { __NA: true };
  guard.back(() => raw.push("back"));
  assert.deepEqual(raw, ["back"]);
});

test("元が 2 つ(フォーム + アップロード中など)でも 1 回の移動に確認は 1 回、立っている理由を全部渡す", async () => {
  const { guard, asked, moves } = setup(true);
  guard.createSource().set(true);
  guard.createSource("inProgress").set(true);
  await guard.request({ kind: "push", href: "/a" }, () => moves.push("go"));
  assert.equal(asked.length, 1);
  assert.deepEqual(asked[0].reasons, ["unsaved", "inProgress"]);
  assert.deepEqual(moves, ["go"]);
});

test("同じ理由の元が 2 つなら理由は 1 つ、外れた元の理由は渡さない", async () => {
  const { guard, asked } = setup(false);
  guard.createSource("inProgress").set(true);
  guard.createSource("inProgress").set(true);
  const form = guard.createSource();
  form.set(true);
  form.set(false);
  await guard.request({ kind: "back" }, () => {});
  assert.deepEqual(asked[0].reasons, ["inProgress"]);
});

test("確認に出す理由: 処理の途中(inProgress)が勝つ、無ければ unsaved", () => {
  assert.equal(pickConfirmReason(["unsaved", "inProgress"]), "inProgress");
  assert.equal(pickConfirmReason(["inProgress"]), "inProgress");
  assert.equal(pickConfirmReason(["unsaved"]), "unsaved");
  assert.equal(pickConfirmReason([]), "unsaved");
});

test("終わるまで守る仕事: Promise が残っている間だけ守る(成功でも失敗でも外す)、Promise でない値は素通り", async () => {
  const { guard } = setup(true);
  const tracker = createTaskTracker(guard.createSource());
  assert.equal(tracker.track(undefined), undefined);
  assert.equal(guard.isDirty(), false, "void は数えない");
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const ok = tracker.track(new Promise<void>((r) => (resolve = r)));
  const ng = tracker.track(new Promise<void>((_, r) => (reject = r)));
  assert.equal(guard.isDirty(), true);
  resolve();
  await ok;
  assert.equal(guard.isDirty(), true, "まだ 1 つ残っている");
  reject(new Error("x"));
  await assert.rejects(ng);
  await tick();
  assert.equal(guard.isDirty(), false);
  assert.equal(tracker.pending(), 0);
});

test("終わるまで守る仕事: 外す設定(guardUnsaved = false)の間は数えても守らない", async () => {
  const { guard } = setup(true);
  const tracker = createTaskTracker(guard.createSource());
  tracker.setEnabled(false);
  let resolve!: () => void;
  const task = tracker.track(new Promise<void>((r) => (resolve = r)));
  assert.equal(guard.isDirty(), false);
  tracker.setEnabled(true);
  assert.equal(guard.isDirty(), true, "戻すと残りの仕事で守る");
  resolve();
  await task;
  await tick();
  assert.equal(guard.isDirty(), false);
});

test("離れずに外れた(保存・元に戻した): 確認を出さずに自分の番兵を 1 つ戻って外し、着いたら popstate も外す", async () => {
  const { guard, fake, asked } = setup(true);
  const source = guard.createSource();
  source.set(true);
  source.set(false);
  assert.equal(fake.backs(), 1, "番兵を history.back で外す");
  landBack(fake);
  await tick();
  assert.deepEqual(asked, [], "確認は出さない");
  assert.equal(fake.backs(), 1, "着いた popstate で戻り続けない");
  assert.equal(fake.pushed.length, 1, "積み直さない");
  assert.equal(fake.listeners.size, 0);
});

test("外した後の replace: 番兵が外れ終わるまで待ってから進む(ページの履歴を置き換える)", async () => {
  const { guard, fake, moves } = setup(true);
  const source = guard.createSource();
  source.set(true);
  source.set(false);
  const done = guard.request({ kind: "replace", href: "/list" }, () => moves.push("replace /list"));
  await tick();
  assert.deepEqual(moves, [], "外れ終わるまで進まない");
  landBack(fake);
  assert.equal(await done, true);
  assert.deepEqual(moves, ["replace /list"]);
  assert.equal(fake.env.win.history.state?.[SENTINEL_KEY], undefined, "進むのはページの履歴の上");
});

test("外す途中の棚の Link: 止めて、外れてから元の href へ(聞かない)", async () => {
  const { guard, fake, asked, moves } = setup(true);
  const source = guard.createSource();
  source.set(true);
  source.set(false);
  const handler = guard.judgeLink("/a", { replace: false, scroll: true });
  assert.ok(handler);
  let prevented = false;
  handler({ preventDefault: () => (prevented = true) } as never);
  assert.equal(prevented, true);
  await tick();
  assert.deepEqual(moves, []);
  landBack(fake);
  await tick();
  assert.deepEqual(moves, ["push /a"]);
  assert.deepEqual(asked, []);
  assert.equal(guard.judgeLink("/a", { replace: false, scroll: true }), undefined, "外れ終われば止めない");
});

test("編集済みの間の戻るは今まで通り確認する(留まる = 積み直し、移る = 戻る)、どちらも番兵を外しに戻らない", async () => {
  const stay = setup(false);
  stay.guard.createSource().set(true);
  stay.fake.env.win.history.state = { __NA: true };
  (stay.fake.listeners.get("popstate") as unknown as () => void)();
  await tick();
  assert.equal(stay.asked.length, 1);
  assert.equal(stay.fake.pushed.length, 2);
  assert.equal(stay.fake.backs(), 0);

  const leave = setup(true);
  const source = leave.guard.createSource();
  source.set(true);
  (leave.fake.listeners.get("popstate") as unknown as () => void)();
  await tick();
  assert.equal(leave.asked.length, 1);
  assert.equal(leave.fake.backs(), 1, "移るの 1 回だけ");
  source.dispose(); // 移った先でフォームが消える
  assert.equal(leave.fake.backs(), 1, "移ると決めた後は番兵を外しに戻らない");
  assert.equal(leave.fake.listeners.size, 0);
});

test("router で「移る」の後に外れた(フォームが消えた): 番兵を外しに戻らない", async () => {
  const { guard, fake, moves } = setup(true);
  const source = guard.createSource();
  source.set(true);
  await guard.request({ kind: "push", href: "/a" }, () => moves.push("push /a"));
  source.dispose();
  assert.deepEqual(moves, ["push /a"]);
  assert.equal(fake.backs(), 0);
  assert.equal(fake.listeners.size, 0);
});

test("外す途中にまた編集済みになった: 確認を出さず、着いてから番兵を積み直す", async () => {
  const { guard, fake, asked } = setup(true);
  const source = guard.createSource();
  source.set(true);
  source.set(false); // 送信の直前に外す
  source.set(true); // 送信が失敗して戻す
  assert.equal(fake.pushed.length, 1, "着くまでは積まない(今の state はまだ番兵)");
  landBack(fake);
  await tick();
  assert.deepEqual(asked, []);
  assert.equal(fake.pushed.length, 2, "着いてから積み直す");
  assert.deepEqual([...fake.listeners.keys()].sort(), ["beforeunload", "popstate"]);
});

test("自分が積んでいない番兵(再読み込みの前の番兵)・番兵でない履歴では戻らない", () => {
  const foreign = setup(true);
  foreign.fake.env.win.history.state = { __NA: true, [SENTINEL_KEY]: true };
  const source = foreign.guard.createSource();
  source.set(true);
  assert.equal(foreign.fake.pushed.length, 0, "番兵の上には積まない");
  source.set(false);
  assert.equal(foreign.fake.backs(), 0);

  const plain = setup(true);
  const other = plain.guard.createSource();
  other.set(true);
  plain.fake.env.win.history.state = { __NA: true };
  other.set(false);
  assert.equal(plain.fake.backs(), 0);
});

test("編集済みにならないページは何も積まず、外しても戻らない", () => {
  const { guard, fake } = setup(true);
  const source = guard.createSource();
  source.set(false);
  source.dispose();
  assert.equal(fake.pushed.length, 0);
  assert.equal(fake.backs(), 0);
});

test("外す history.back の popstate が来なくても、待つのをやめて進む", async () => {
  const { guard, fake, moves } = setup(true);
  const source = guard.createSource();
  source.set(true);
  source.set(false);
  const done = guard.request({ kind: "replace", href: "/list" }, () => moves.push("replace /list"));
  await new Promise((resolve) => setTimeout(resolve, SENTINEL_REMOVAL_TIMEOUT_MS + 50));
  assert.equal(await done, true);
  assert.deepEqual(moves, ["replace /list"]);
  assert.equal(fake.listeners.size, 0);
});
