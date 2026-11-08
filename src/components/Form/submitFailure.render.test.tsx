// AppForm の送信が失敗したときの扱いの検査(失敗 = throw の約束、unsavedGuard README)。
// - DOM の送信(<form onSubmit>)の失敗は AppForm の外へ未処理の reject として漏れない。守りは戻り、移動しない
// - await する呼び手(onSubmit の中の customSubmit など)には失敗がそのまま届く
// - メディアのコミットが失敗したときも守りを戻す
// 実行: pnpm test src/components/Form/submitFailure.render.test.tsx(tsx + node:test + jsdom の上で描画)
// (package.json に type: module が無いので tsx は CJS として読む = top-level await 不可 → before() で import)
import { after, afterEach, before, test } from "node:test";
import assert from "node:assert/strict";
import { createElement, useEffect, type ReactNode } from "react";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
const g = globalThis as Record<string, unknown>;
for (const key of ["window", "document", "HTMLElement", "HTMLInputElement", "Node", "Event", "navigator", "getComputedStyle"]) {
  // navigator は Node の組み込み(getter だけ)なので defineProperty で差し替える
  const value = key === "window" ? dom.window : (dom.window as unknown as Record<string, unknown>)[key];
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}
g.IS_REACT_ACT_ENVIRONMENT = true;

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let useForm: typeof import("react-hook-form").useForm;
let AppForm: typeof import("@/components/Form").AppForm;
let useAppFormMedia: typeof import("@/components/Form/AppForm").useAppFormMedia;
let NavigationPortProvider: typeof import("@/components/Navigation/NavigationPort").NavigationPortProvider;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ useForm } = await import("react-hook-form"));
  ({ AppForm } = await import("@/components/Form"));
  ({ useAppFormMedia } = await import("@/components/Form/AppForm"));
  ({ NavigationPortProvider } = await import("@/components/Navigation/NavigationPort"));
});
after(() => dom.window.close());

// 未処理の reject を拾う(DOM の送信の失敗が漏れれば、ここに入る)
const unhandled: unknown[] = [];
const onUnhandled = (reason: unknown) => {
  unhandled.push(reason);
};
before(() => {
  process.on("unhandledRejection", onUnhandled);
});
after(() => {
  process.off("unhandledRejection", onUnhandled);
});
afterEach(() => {
  unhandled.length = 0;
});

type Values = { title: string };

type Probe = {
  container: HTMLElement;
  /** 守りの元が受けた set の履歴(最後 = 今の状態) */
  guard: boolean[];
  /** router.push の呼ばれた先 */
  pushes: string[];
  unmount: () => Promise<void>;
};

/** 個別のメディアの欄の代わり: commit だけ持つハンドルを登録する */
const FakeMedia = ({ commit }: { commit: () => Promise<void> }): ReactNode => {
  const media = useAppFormMedia();
  useEffect(() => {
    media?.registerMediaHandle("image", { isUploading: false, commit, reset: async () => {} });
    return () => media?.unregisterMediaHandle("image");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
};

const mount = async (options: { onSubmit: (values: Values) => Promise<void>; commit?: () => Promise<void> }): Promise<Probe> => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const guard: boolean[] = [];
  const pushes: string[] = [];
  const noop = () => {};
  const port = {
    router: { push: (href: string) => void pushes.push(href), replace: noop, back: noop, forward: noop, refresh: noop, prefetch: noop },
    judgeLink: () => undefined,
    linkAttributes: {},
    createUnsavedSource: () => ({ set: (active: boolean) => void guard.push(active), dispose: noop }),
  };
  const Form = (): ReactNode => {
    const methods = useForm<Values>({ defaultValues: { title: "" } });
    const children = [
      createElement("input", { key: "title", ...methods.register("title") }),
      options.commit ? createElement(FakeMedia, { key: "media", commit: options.commit }) : null,
      createElement("button", { key: "submit", type: "submit" }, "保存"),
    ];
    // children を props で渡す(AppForm の props 型は children が必須。createElement の第 3 引数では型に乗らない)
    const props = { methods, onSubmit: options.onSubmit, children };
    return createElement(AppForm<Values>, props);
  };
  const portProps = { value: port, children: createElement(Form) };
  await act(async () => root.render(createElement(NavigationPortProvider, portProps)));
  return { container, guard, pushes, unmount: () => act(async () => root.unmount()) };
};

/** 入力して編集済みにする(React の onChange は input イベントで来る) */
const edit = (container: HTMLElement, value: string) =>
  act(async () => {
    const input = container.querySelector("input") as HTMLInputElement;
    // React は value の setter を見張るので、素の setter で入れないと変更として拾わない
    const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, value);
    input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

const submit = (container: HTMLElement) =>
  act(async () => {
    const form = container.querySelector("form") as HTMLFormElement;
    form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
    // 未処理の reject の判定は microtask の後に来るので、マクロタスクを 2 回待つ
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

test("DOM の送信が失敗しても reject は漏れず、守りが戻り、移動しない", async () => {
  const view = await mount({
    onSubmit: async () => {
      throw new Error("保存に失敗しました");
    },
  });
  await edit(view.container, "変更");
  assert.equal(view.guard.at(-1), true, "編集済みで守る");

  await submit(view.container);
  assert.deepEqual(unhandled, [], "未処理の reject が出ない");
  assert.equal(view.guard.at(-1), true, "失敗の後は守りが戻る");
  assert.ok(view.guard.includes(false), "送信の間は守りを外している");
  assert.deepEqual(view.pushes, [], "移動しない");

  // 失敗の後もロックは外れ、また送れる
  await submit(view.container);
  assert.deepEqual(unhandled, []);
  await view.unmount();
});

test("await する呼び手(customSubmit の形)には失敗がそのまま届く", async () => {
  const seen: unknown[] = [];
  const handler = async () => {
    throw new Error("初期設定に失敗しました");
  };
  const view = await mount({
    // AdminManagerialUserCreateForm の customSubmit と同じ形: onSubmit の中で handler を await する
    onSubmit: async () => {
      try {
        await handler();
      } catch (error) {
        seen.push(error);
        throw error;
      }
    },
  });
  await edit(view.container, "変更");
  await submit(view.container);
  assert.equal(seen.length, 1, "呼び手は reject を受け取る");
  assert.match(String(seen[0]), /初期設定に失敗しました/);
  assert.deepEqual(unhandled, [], "AppForm の外へは漏れない");
  assert.equal(view.guard.at(-1), true);
  await view.unmount();
});

test("メディアのコミットが失敗しても守りを戻す", async () => {
  let commits = 0;
  const view = await mount({
    onSubmit: async () => {},
    commit: async () => {
      commits += 1;
      throw new Error("コミットに失敗しました");
    },
  });
  await edit(view.container, "変更");
  await submit(view.container);
  assert.equal(commits, 1);
  assert.deepEqual(unhandled, [], "未処理の reject が出ない");
  assert.equal(view.guard.at(-1), true, "コミットの失敗の後も守りが戻る");
  await view.unmount();
});

test("成功すれば守りを外したままにする", async () => {
  const view = await mount({ onSubmit: async () => {}, commit: async () => {} });
  await edit(view.container, "変更");
  await submit(view.container);
  assert.equal(view.guard.at(-1), false, "成功の後は次の入力まで守らない");
  await edit(view.container, "もう一度");
  assert.equal(view.guard.at(-1), true, "次の入力でまた守る");
  await view.unmount();
});
