// src/lib/frameDims/useFrameDimsStyle.test.ts — pnpm test src/lib/frameDims
// 測るのは枠が登録した外枠だけ(D92): 文書の最初の [data-frame-root] を探さない
import { test } from "node:test";
import assert from "node:assert/strict";

import { frameDimsConfigDef } from "./config";
import { currentFrameRoot, registerFrameRoot, subscribeFrameRoots } from "./frameRoot";
import { FRAME_OBSERVE_OPTIONS, readFrameDimsStyle, subscribeFrameDims } from "./useFrameDimsStyle";

const element = (name: string, connected = true) => ({ tagName: name, isConnected: connected }) as unknown as Element;
const frameRoot = element("DIV");

// 上流の既定(読み込んだ frameDimsConfig は fork が src/config/lib/frameDims.config.ts に書いた値で変わる)
const defaults = frameDimsConfigDef.compose({});

const readStyle = (values: Record<string, string>, expected: Element = frameRoot) => (el: Element) => {
  assert.equal(el, expected);
  return { getPropertyValue: (name: string) => values[name] ?? "" };
};

test("外枠が無い時(登録が無い)は空", () => {
  assert.deepEqual(readFrameDimsStyle(null, readStyle({}), defaults), {});
});

test("外枠に書かれた寸法変数の計算値を写す", () => {
  const style = readFrameDimsStyle(
    frameRoot,
    readStyle({ "--app-header-height": " 56px", "--app-bottom-nav-height": "calc(64px + env(safe-area-inset-bottom, 0px))" }),
    defaults,
  );
  assert.deepEqual(style, { "--app-header-height": "56px", "--app-bottom-nav-height": "calc(64px + env(safe-area-inset-bottom, 0px))" });
});

test("隠している間に 0 になった値もそのまま写す", () => {
  assert.deepEqual(readFrameDimsStyle(frameRoot, readStyle({ "--app-bottom-nav-height": "0px" }), defaults), { "--app-bottom-nav-height": "0px" });
});

test("既定の設定 = 枠の部位一覧の寸法変数(src/styles/core/frame.css の名前)。外枠の印の設定は無い(枠が登録する)", () => {
  assert.deepEqual(defaults, {
    vars: { header: "--app-header-height", "app-banner": "--app-banner-height", "bottom-nav": "--app-bottom-nav-height" },
  });
});

test("上書きした変数の名前で読む", () => {
  const style = readFrameDimsStyle(frameRoot, readStyle({ "--shell-top": "48px", "--app-header-height": "56px" }), {
    vars: { header: "--shell-top", "app-banner": "--shell-banner", "bottom-nav": "--shell-bottom" },
  });
  assert.deepEqual(style, { "--shell-top": "48px" });
});

test("登録: 測る相手は最後に登録した外枠、外すと前の外枠へ戻る、つながっていない外枠は飛ばす、登録の無い外枠は拾わない", () => {
  assert.equal(currentFrameRoot(), null, "登録の無い [data-frame-root](fork の自前の枠・隠れた枠)は拾わない");
  let changes = 0;
  const stop = subscribeFrameRoots(() => (changes += 1));
  const user = element("USER");
  const admin = element("ADMIN");
  const offUser = registerFrameRoot(user);
  const offAdmin = registerFrameRoot(admin);
  assert.equal(currentFrameRoot(), admin);
  offAdmin();
  assert.equal(currentFrameRoot(), user);
  offAdmin();
  assert.equal(changes, 3, "2 度目の外しは知らせない");
  const detached = element("DETACHED", false);
  const offDetached = registerFrameRoot(detached);
  assert.equal(currentFrameRoot(), user, "文書から外れた外枠は測らない");
  offDetached();
  offUser();
  assert.equal(currentFrameRoot(), null);
  stop();
});

/** subscribe の環境の偽物: 登録・observe の呼び方を記録し、変化を手で起こせる */
function fakeEnv(initial: Element | null) {
  let root = initial;
  let rootsChanged: (() => void) | null = null;
  const observes: { target: Element; options: MutationObserverInit }[] = [];
  const disconnected: Element[] = [];
  let mutate: (() => void) | null = null;
  const frames: (() => void)[] = [];
  const listeners = new Map<string, () => void>();
  const env = {
    getRoot: () => root,
    subscribeRoots: (fn: () => void) => {
      rootsChanged = fn;
      return () => (rootsChanged = null);
    },
    win: {
      addEventListener: (type: string, fn: () => void) => listeners.set(type, fn),
      removeEventListener: (type: string) => listeners.delete(type),
      requestAnimationFrame: (fn: () => void) => frames.push(fn),
      cancelAnimationFrame: () => {},
    } as never,
    createObserver: (callback: () => void) => {
      mutate = callback;
      let target: Element | null = null;
      return {
        observe: (t: Element, options?: MutationObserverInit) => {
          target = t;
          observes.push({ target: t, options: options ?? {} });
        },
        disconnect: () => target && disconnected.push(target),
      };
    },
  };
  const swap = (next: Element | null) => {
    root = next;
    rootsChanged?.();
  };
  return { env, observes, disconnected, swap, mutate: () => mutate?.(), flush: () => frames.splice(0).forEach((fn) => fn()), listeners };
}

test("外枠を 1 回の observe で属性と子孫の両方を見る(2 回目の observe が 1 回目の指定を置き換えない)", () => {
  const fake = fakeEnv(frameRoot);
  subscribeFrameDims(() => {}, fake.env);
  assert.equal(fake.observes.length, 1);
  assert.equal(fake.observes[0].target, frameRoot);
  assert.deepEqual(fake.observes[0].options, { attributes: true, childList: true, subtree: true });
  assert.deepEqual({ ...FRAME_OBSERVE_OPTIONS }, { attributes: true, childList: true, subtree: true });
});

test("外枠の属性だけの変化(inline の寸法)でも 1 フレームに 1 回読み直す、片付けで resize を外す", () => {
  const fake = fakeEnv(frameRoot);
  let calls = 0;
  const unsubscribe = subscribeFrameDims(() => (calls += 1), fake.env);
  fake.mutate();
  fake.mutate();
  fake.flush();
  assert.equal(calls, 1);
  fake.listeners.get("resize")?.();
  fake.flush();
  assert.equal(calls, 2);
  unsubscribe();
  assert.equal(fake.listeners.has("resize"), false);
});

test("外枠が無い時は observe せず resize と登録だけ見る、登録されたら observe して読み直す", () => {
  const fake = fakeEnv(null);
  let calls = 0;
  subscribeFrameDims(() => (calls += 1), fake.env);
  assert.equal(fake.observes.length, 0);
  assert.equal(fake.listeners.has("resize"), true);
  fake.swap(frameRoot);
  fake.flush();
  assert.equal(fake.observes.length, 1);
  assert.equal(calls, 1);
});

test("外枠が替わると前の observer を外して新しい外枠に付け直す", () => {
  const fake = fakeEnv(frameRoot);
  subscribeFrameDims(() => {}, fake.env);
  const next = element("NEXT");
  fake.swap(next);
  assert.deepEqual(fake.disconnected, [frameRoot]);
  assert.equal(fake.observes.at(-1)?.target, next);
});
