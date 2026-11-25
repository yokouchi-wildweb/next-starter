// 画面の作り手(createScreenMaker → createScreen、D110)の契約
// - Screen = 境界(Suspense)の内側の部品が load の後にだけ render(data, props) を返す。fallback は既定か画面の指定
// - load が投げたら(redirect / notFound)render も題名も返さない
// - generateMetadata = 値は load を通してから、関数は load の結果で、省略は load を呼ばずに空
// 描画器を通さず、要素の木を直に辿る(内側の部品は async の関数なので呼んで待つ)
// 実行: pnpm test src/lib/screens/createScreen.test.tsx
import { test } from "node:test";
import assert from "node:assert/strict";
import { Suspense, isValidElement, type ReactElement, type ReactNode } from "react";

import { createScreenMaker } from "./createScreen";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, never>> };
const props: Props = { params: Promise.resolve({ id: "1" }), searchParams: Promise.resolve({}) };

const DEFAULT = <span>default-wait</span>;
const createScreen = createScreenMaker({ defaultFallback: DEFAULT });

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Screen の返す境界を開き、fallback と内側の部品を取り出す */
function open(node: ReactNode) {
  assert.ok(isValidElement(node));
  const boundary = node as ReactElement<{ fallback: ReactNode; children: ReactElement }>;
  assert.equal(boundary.type, Suspense, "外側は境界(Suspense)だけ");
  const inner = boundary.props.children;
  assert.ok(isValidElement(inner));
  const body = () => (inner.type as (p: unknown) => Promise<ReactNode>)(inner.props);
  return { fallback: boundary.props.fallback, body };
}

/** 内側の部品の返す断片の中身 */
const contentOf = (node: ReactNode) => (node as ReactElement<{ children: ReactNode }>).props.children;

test("load が解けるまで render を呼ばず、解けたら render に data と props を渡す", async () => {
  const gate = deferred<{ title: string }>();
  const calls: unknown[][] = [];
  const { Screen } = createScreen<Props, { title: string }>({
    load: () => gate.promise,
    render: (data, p) => {
      calls.push([data, p]);
      return <h1>{data.title}</h1>;
    },
  });
  const pending = open(Screen(props)).body();
  await new Promise((r) => setImmediate(r));
  assert.equal(calls.length, 0, "load の前に本文(見出し)を作らない");
  gate.resolve({ title: "t" });
  const out = await pending;
  assert.deepEqual(calls, [[{ title: "t" }, props]]);
  assert.equal((contentOf(out) as ReactElement).type, "h1");
});

test("render は async でもよい(待ってから返す)", async () => {
  const { Screen } = createScreen<Props, number>({
    load: async () => 2,
    render: async (n) => <p>{n * 2}</p>,
  });
  const out = await open(Screen(props)).body();
  assert.equal((contentOf(out) as ReactElement<{ children: number }>).props.children, 4);
});

test("fallback: 省略は既定、指定は画面の物", () => {
  const plain = createScreen<Props, void>({ load: async () => undefined, render: () => null });
  assert.equal(open(plain.Screen(props)).fallback, DEFAULT);
  const own = <span>own</span>;
  const custom = createScreen<Props, void>({ load: async () => undefined, render: () => null, fallback: own });
  assert.equal(open(custom.Screen(props)).fallback, own);
});

test("load が投げたら(redirect / notFound)render も題名も返さず、そのまま投げる", async () => {
  const denied = Object.assign(new Error("NEXT_NOT_FOUND"), { digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
  let rendered = 0;
  let titled = 0;
  const { Screen, generateMetadata } = createScreen<Props, string>({
    load: async () => {
      throw denied;
    },
    render: () => {
      rendered += 1;
      return null;
    },
    metadata: () => {
      titled += 1;
      return { title: "secret" };
    },
  });
  await assert.rejects(open(Screen(props)).body(), (e) => e === denied);
  await assert.rejects(generateMetadata(props), (e) => e === denied);
  assert.equal(rendered, 0);
  assert.equal(titled, 0);
});

test("metadata の値は load を通してから返す", async () => {
  const gate = deferred<void>();
  let loaded = 0;
  const { generateMetadata } = createScreen<Props, void>({
    load: async () => {
      loaded += 1;
      await gate.promise;
    },
    render: () => null,
    metadata: { title: "fixed" },
  });
  let done = false;
  const result = generateMetadata(props).then((m) => {
    done = true;
    return m;
  });
  await new Promise((r) => setImmediate(r));
  assert.equal(loaded, 1);
  assert.equal(done, false, "load の前に題名を返さない");
  gate.resolve();
  assert.deepEqual(await result, { title: "fixed" });
});

test("metadata の関数は load の結果と props で作る", async () => {
  const seen: unknown[][] = [];
  const { generateMetadata } = createScreen<Props, { name: string }>({
    load: async () => ({ name: "n" }),
    render: () => null,
    metadata: async (data, p) => {
      seen.push([data, p]);
      return { title: data.name };
    },
  });
  assert.deepEqual(await generateMetadata(props), { title: "n" });
  assert.deepEqual(seen, [[{ name: "n" }, props]]);
});

test("metadata の省略は load を呼ばずに空", async () => {
  let loaded = 0;
  const { generateMetadata } = createScreen<Props, void>({
    load: async () => {
      loaded += 1;
    },
    render: () => null,
  });
  assert.deepEqual(await generateMetadata(props), {});
  assert.equal(loaded, 0);
});
