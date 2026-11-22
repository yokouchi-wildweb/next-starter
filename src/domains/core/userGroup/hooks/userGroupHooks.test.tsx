// ユーザーグループの管理画面の hook の検査(jsdom の上で描く。client service・toast・離れる前の確認は偽物)。
// - 条件の組み立て: 保存した定義 ⇄ 画面の組(2 段まで・not)、深い定義は読むだけ(null)、問題・重い部品、足す・外す・組は根だけ、変えたかは中身で
// - 条件の引数: 日時は ISO の文字・空の欄は落とす・数の文字は数
// - 一覧: 種類・状態を渡す / onChanged(作った = 取り直し、保管 = 外す、ほか = 置き換え)
// - 書く欄: 作る(動的の POST・固定は startStatic)/ 直す(変えた欄だけ PATCH)/ 種類の選択肢 / 重い条件の注意
// - 固定: incomplete の間は同じ元で送り直し、進み具合と終わり / 見込み: 理由・古い見込み / 一員・例外: 足す・外す
// - 既存の固定のグループに足す(一括操作): mode add の結果、断られた理由
// - モーダル: 固定の進み具合は始めた開いた回だけ(閉じて開き直すと出さない)
// 実行: pnpm test src/domains/core/userGroup/hooks/userGroupHooks.test.tsx
import { after, before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement, useState } from "react";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.IS_REACT_ACT_ENVIRONMENT = true;
g.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const ID = "11111111-1111-4111-8111-111111111111";
const detail = (extra: Record<string, unknown> = {}) => ({
  id: ID,
  name: "常連",
  description: null,
  kind: "dynamic",
  kindLabel: "動的",
  status: "active",
  statusLabel: "使用中",
  count: { value: 3, state: "estimated" },
  recompute: null,
  createdAt: "2026-11-14T00:00:00.000Z",
  updatedAt: "2026-11-14T00:00:00.000Z",
  definition: { op: "and", children: [{ part: "role", args: { roles: ["user"] } }] },
  heavy: false,
  notices: [],
  exceptions: { includeCount: 0, excludeCount: 0 },
  ...extra,
});
const CATALOG = {
  criteria: [
    { key: "role", label: "ロール", description: null, weight: "cheap", weightLabel: "軽い", fields: [{ name: "roles", label: "ロール", formInput: "multiSelect" }] },
    {
      key: "hasTag",
      label: "タグ",
      description: null,
      weight: "cheap",
      weightLabel: "軽い",
      fields: [
        { name: "tagIds", label: "タグ", formInput: "multiSelect" },
        { name: "match", label: "合わせ方", formInput: "radio", defaultValue: "any" },
      ],
    },
    { key: "slow", label: "重い部品", description: null, weight: "heavy", weightLabel: "重い(定期計算向け)", fields: [] },
  ],
  options: { roles: [], statuses: [], tags: [], staticGroups: [] },
  kinds: [
    { value: "dynamic", label: "動的" },
    { value: "scheduled", label: "定期計算" },
    { value: "static", label: "固定" },
  ],
};

const listCalls: Record<string, unknown>[] = [];
const calls: unknown[][] = [];
let staticRounds: Array<Record<string, unknown>> = [];
let estimateError: Error | null = null;
mock.module("@/domains/core/userGroup/services/client/userGroupAdminClient", {
  namedExports: {
    // J112(D101): the membership editor imports these; D69: no assertion until the tests are restored
    searchUserGroupPeople: async () => ({ items: [], nextCursor: null }),
    applyUserGroupPeople: async (_id: string, input: { target: string }) => ({ target: input.target, added: 0, removed: 0, moved: 0, counts: { memberCount: 0 } }),
    // J105(D92): the row actions hook imports it; D69: no assertion until the tests are restored
    deleteUserGroup: async (id: string) => ({ id, deleted: true }),
    listUserGroups: async (params: Record<string, unknown>) => {
      listCalls.push(params);
      return { items: [detail(), detail({ id: "g2", name: "新人" })], nextCursor: null };
    },
    getUserGroup: async () => detail(),
    getUserGroupCriteria: async () => CATALOG,
    createUserGroup: async (input: unknown) => {
      calls.push(["create", input]);
      return detail({ id: "new-id" });
    },
    updateUserGroup: async (id: string, input: unknown) => {
      calls.push(["update", id, input]);
      return detail();
    },
    archiveUserGroup: async (id: string) => {
      calls.push(["archive", id]);
      return detail({ status: "archived" });
    },
    estimateUserGroup: async (input: unknown) => {
      calls.push(["estimate", input]);
      if (estimateError) throw estimateError;
      return { count: 2, memberLimit: 100, overLimit: false, heavy: false, sample: [{ id: "u1", name: "花子" }] };
    },
    createStaticUserGroup: async (input: unknown) => {
      calls.push(["static", input]);
      return { group: detail({ id: "s1", kind: "static", name: "固定" }), members: staticRounds.shift() };
    },
    updateStaticMembers: async (id: string, input: Record<string, unknown>) => {
      calls.push(["members", id, input]);
      if (input.mode === "remove") return { memberCount: 1 };
      if (input.mode === "add" && (input.userIds as string[]).includes("over")) throw new Error("人数の上限を超えます");
      if (input.mode === "add") return { group: detail({ id, kind: "static" }), members: { status: "added", added: 1, skipped: 0, memberCount: 2 } };
      return { group: detail({ id, kind: "static", name: "固定" }), members: staticRounds.shift() };
    },
    listStaticMembers: async (id: string, params: unknown) => {
      calls.push(["listMembers", id, params]);
      return { items: [{ id: "u1", name: "花子" }, { id: "u2", name: null }], nextCursor: null };
    },
    listUserGroupExceptions: async (id: string, params: Record<string, unknown>) => {
      calls.push(["listExceptions", id, params.side]);
      return { items: [{ id: "u9", name: "太郎" }], nextCursor: null };
    },
    updateUserGroupExceptions: async (id: string, input: unknown) => {
      calls.push(["exceptions", id, input]);
      return detail({ exceptions: { includeCount: 1, excludeCount: 0 } });
    },
  },
});
// J110(D94): the people hook uses useLoadingToast while adding; D69: no assertion until the tests are restored
mock.module("@/lib/toast", { namedExports: { useToast: () => ({ showToast: () => {} }), useLoadingToast: () => {} } });
const guarded: boolean[] = [];
mock.module("@/lib/unsavedGuard", { namedExports: { useUnsavedGuard: (when: boolean) => void guarded.push(when) } });

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let hooks: typeof import("./index");
let SWRConfig: typeof import("swr").SWRConfig;
before(async () => {
  ({ act } = await import("react"));
  ({ createRoot } = await import("react-dom/client"));
  ({ SWRConfig } = await import("swr"));
  hooks = await import("./index");
});
after(() => dom.window.close());
beforeEach(() => {
  listCalls.length = 0;
  calls.length = 0;
  guarded.length = 0;
  staticRounds = [];
  estimateError = null;
});

const mount = async <T,>(useHook: () => T) => {
  const latest: { current: T | null } = { current: null };
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const Probe = ({ report }: { report: (value: T) => void }) => {
    report(useHook());
    return null;
  };
  await act(async () => {
    root.render(
      createElement(
        SWRConfig,
        { value: { provider: () => new Map(), dedupingInterval: 0 } },
        createElement(Probe, { report: (value: T) => (latest.current = value) }),
      ),
    );
  });
  return { value: () => latest.current!, unmount: () => act(async () => root.unmount()) };
};

const strip = (node: unknown): unknown => JSON.parse(JSON.stringify(node));

test("条件: 保存した定義 ⇄ 画面の組(2 段・not)、根の条件 1 つは組に入れる", () => {
  const definition = {
    op: "or",
    children: [
      { part: "role", args: { roles: ["user"] } },
      { op: "not", child: { part: "hasTag", args: { tagIds: ["t"], match: "any" } } },
      { op: "not", child: { op: "and", children: [{ part: "role", args: {} }, { op: "not", child: { part: "slow" } }] } },
    ],
  } as const;
  const root = hooks.conditionFromDefinition(definition as never);
  assert.ok(root);
  assert.equal(root.op, "or");
  assert.equal(root.children[1].negate, true);
  assert.equal(root.children[2].type, "group");
  assert.deepEqual(strip(hooks.conditionToDefinition(root)), {
    ...definition,
    children: [definition.children[0], definition.children[1], { op: "not", child: { op: "and", children: [{ part: "role", args: {} }, { op: "not", child: { part: "slow", args: {} } }] } }],
  });
  const single = hooks.conditionFromDefinition({ op: "not", child: { part: "role", args: {} } });
  assert.deepEqual(strip(hooks.conditionToDefinition(single!)), { op: "and", children: [{ op: "not", child: { part: "role", args: {} } }] });
  assert.equal(hooks.conditionFromDefinition(null)?.children.length, 0);
});

test("条件: 3 段以上・not の重なりは組めない(読むだけ = null)", () => {
  const deep = { op: "and", children: [{ op: "or", children: [{ op: "and", children: [{ part: "role" }] }] }] };
  assert.equal(hooks.conditionFromDefinition(deep as never), null);
  assert.equal(hooks.conditionFromDefinition({ op: "not", child: { op: "not", child: { part: "role" } } } as never), null);
});

test("条件: 問題(空の組・知らない部品)と重い部品", () => {
  const root = hooks.conditionFromDefinition({ op: "and", children: [{ part: "gone" }, { op: "or", children: [{ part: "slow" }] }] } as never)!;
  assert.deepEqual(hooks.conditionProblems(root, CATALOG.criteria as never), ["使用できない条件があります(削除してください)"]);
  assert.equal(hooks.conditionHasHeavy(root, CATALOG.criteria as never), true);
  assert.deepEqual(hooks.conditionProblems(hooks.emptyConditionRoot(), CATALOG.criteria as never), ["条件を 1 つ以上追加してください"]);
});

test("条件の引数: 日時は ISO・空の欄は落とす・数の文字は数、ISO は Date へ戻す", () => {
  const fields = [
    { name: "from", formInput: "datetimeInput" },
    { name: "withinDays", formInput: "numberInput" },
    { name: "tagIds", formInput: "multiSelect" },
    { name: "match", formInput: "radio" },
  ] as never;
  const at = new Date("2026-11-01T00:00:00.000Z");
  assert.deepEqual(hooks.criterionArgsOf(fields, { from: at, withinDays: "7", tagIds: [], match: "" }), { from: at.toISOString(), withinDays: 7 });
  const values = hooks.criterionFormValues(fields, { from: at.toISOString(), match: "all" });
  assert.ok(values.from instanceof Date);
  assert.equal(values.match, "all");
});

test("useUserGroupConditionBuilder: 足す(初めの引数)・組は根だけ・not・外す。変えたかは中身で決まる", async () => {
  const view = await mount(() => hooks.useUserGroupConditionBuilder({ definition: null, criteria: CATALOG.criteria as never }));
  const b = () => view.value();
  assert.equal(b().touched, false);
  await act(async () => b().actions.addCriterion(b().root!.id, "hasTag"));
  assert.deepEqual((strip(b().root!.children[0]) as { args: unknown }).args, { match: "any" });
  await act(async () => b().actions.addGroup(b().root!.id));
  const inner = b().root!.children[1];
  await act(async () => b().actions.addGroup(inner.id));
  assert.equal((b().root!.children[1] as { children: unknown[] }).children.length, 0, "組の中の組は足さない(2 段まで)");
  await act(async () => b().actions.addCriterion(inner.id, "slow"));
  await act(async () => b().actions.setNegate(inner.id, true));
  assert.equal(b().heavy, true);
  assert.deepEqual(strip(b().toDefinition()), {
    op: "and",
    children: [{ part: "hasTag", args: { match: "any" } }, { op: "not", child: { op: "or", children: [{ part: "slow", args: {} }] } }],
  });
  await act(async () => b().actions.remove(inner.id));
  assert.equal(b().heavy, false);
  assert.equal(b().touched, true);
  await view.unmount();

  const saved = await mount(() =>
    hooks.useUserGroupConditionBuilder({ definition: { op: "and", children: [{ part: "role", args: { roles: ["user"] } }] }, criteria: CATALOG.criteria as never }),
  );
  const leaf = saved.value().root!.children[0];
  await act(async () => saved.value().actions.setArgs(leaf.id, { roles: ["user"] }));
  assert.equal(saved.value().touched, false, "同じ値の書き戻しは変えていない");
  await act(async () => saved.value().actions.setArgs(leaf.id, { roles: ["admin"] }));
  assert.equal(saved.value().touched, true);
  await saved.unmount();
});

test("useUserGroupConditionBuilder: 深い定義は読むだけ、作り直すで空の組", async () => {
  const deep = { op: "and", children: [{ op: "or", children: [{ op: "and", children: [{ part: "role" }] }] }] } as never;
  const view = await mount(() => hooks.useUserGroupConditionBuilder({ definition: deep, criteria: CATALOG.criteria as never }));
  assert.equal(view.value().readOnly, true);
  assert.ok(view.value().readOnlyNote);
  assert.equal(view.value().toDefinition(), deep, "読むだけのままなら元の定義");
  await act(async () => view.value().actions.reset());
  assert.equal(view.value().readOnly, false);
  assert.equal(view.value().touched, true);
  await view.unmount();
});

test("useAdminUserGroupList: 種類・状態を渡す(既定はすべて)。作った = 取り直し / 絞りに合わない = 外す / ほか = 置き換え", async () => {
  const view = await mount(() => hooks.useAdminUserGroupList());
  // J100: 状態の絞りの既定は「すべて」(status を送らない)
  assert.deepEqual(listCalls.at(-1), { kind: undefined, status: undefined, cursor: null, limit: 20 });
  await act(async () => view.value().setKind("static"));
  assert.equal(listCalls.at(-1)?.kind, "static");
  await act(async () => view.value().setKind(""));
  await act(async () => view.value().modal.onChanged(detail({ name: "直した" }) as never, "update"));
  assert.equal(view.value().query.items[0].name, "直した");
  // J100: 絞りが「すべて」なら保管しても行は残り、状態だけ変わる
  await act(async () => view.value().modal.onChanged(detail({ status: "archived" }) as never, "archive"));
  assert.deepEqual(view.value().query.items.map((item) => [item.id, item.status]), [[ID, "archived"], ["g2", "active"]]);
  // 「使用中」で絞っている時に保管すると行を外す
  await act(async () => view.value().setStatus("active"));
  await act(async () => view.value().modal.onChanged(detail({ status: "archived" }) as never, "archive"));
  assert.deepEqual(view.value().query.items.map((item) => item.id), ["g2"]);
  const before = listCalls.length;
  await act(async () => view.value().modal.onChanged(detail({ id: "n" }) as never, "create"));
  assert.equal(listCalls.length, before + 1);
  await act(async () => view.value().modal.openGroup("g2"));
  assert.deepEqual([view.value().modal.open, view.value().modal.groupId], [true, "g2"]);
  await view.unmount();
});

test("useUserGroupForm(作る): 動的は定義つきの POST、固定は startStatic(一員の元)", async () => {
  const changed: string[] = [];
  const created: string[] = [];
  const started: unknown[] = [];
  const view = await mount(() =>
    hooks.useUserGroupForm({
      group: null,
      catalog: CATALOG as never,
      onCreated: (id) => created.push(id),
      onChanged: (_g, action) => changed.push(action),
      startStatic: async (input) => void started.push(input),
    }),
  );
  const f = () => view.value();
  assert.equal(f().dirty, false);
  assert.deepEqual(f().fields.kindOptions.map((o) => o.value), ["dynamic", "scheduled", "static"]);
  await act(async () => f().fields.setName("常連"));
  assert.equal(f().canSave, false, "条件がまだ無い");
  await act(async () => f().condition.actions.addCriterion(f().condition.root!.id, "role"));
  await act(async () => f().fields.setKind("scheduled"));
  await act(async () => f().fields.setIntervalMinutes(360));
  assert.equal(f().canSave, true);
  assert.equal(guarded.at(-1), true);
  await act(async () => f().save());
  assert.deepEqual(strip(calls[0]), [
    "create",
    { name: "常連", description: null, kind: "scheduled", definition: { op: "and", children: [{ part: "role", args: {} }] }, recomputeIntervalMinutes: 360 },
  ]);
  assert.deepEqual([created, changed], [["new-id"], ["create"]]);

  await act(async () => f().fields.setKind("static"));
  assert.equal(f().canSave, true, "選んだ人 = 0 人でも作れる");
  await act(async () => f().fields.setSource({ type: "tag", userIds: [], tagId: "", groupId: "" }));
  assert.deepEqual(f().problems, ["メンバーの指定方法を選んでください"]);
  await act(async () => f().fields.setSource({ type: "tag", userIds: [], tagId: "tag-1", groupId: "" }));
  await act(async () => f().save());
  assert.deepEqual(started, [{ name: "常連", description: null, from: { type: "tag", tagId: "tag-1" } }]);
  await view.unmount();
});

test("useUserGroupForm(直す): 変えた欄だけ PATCH、種類は動的 ⇄ 定期計算だけ、重い条件の注意、保管", async () => {
  const changed: string[] = [];
  const view = await mount(() =>
    hooks.useUserGroupForm({ group: detail({ heavy: true, definition: { op: "and", children: [{ part: "slow" }] } }) as never, catalog: CATALOG as never, onChanged: (_g, a) => changed.push(a) }),
  );
  const f = () => view.value();
  assert.deepEqual(f().fields.kindOptions.map((o) => o.value), ["dynamic", "scheduled"]);
  assert.equal(f().heavyWarning, hooks.HEAVY_WARNING);
  assert.equal(f().dirty, false);
  await act(async () => f().fields.setKind("static"));
  assert.equal(f().fields.kind, "dynamic", "固定へは変えない");
  await act(async () => f().fields.setDescription("よく来る人"));
  await act(async () => f().fields.setKind("scheduled"));
  assert.equal(f().heavyWarning, null, "定期計算なら注意を出さない");
  await act(async () => f().save());
  assert.deepEqual(calls[0], ["update", ID, { description: "よく来る人", kind: "scheduled" }]);
  await act(async () => f().archive());
  assert.deepEqual(calls[1], ["archive", ID]);
  assert.deepEqual(changed, ["update", "archive"]);
  await view.unmount();

  const fixed = await mount(() => hooks.useUserGroupForm({ group: detail({ kind: "static", definition: null }) as never, catalog: CATALOG as never }));
  assert.deepEqual(fixed.value().fields.kindOptions.map((o) => o.value), ["static"]);
  assert.equal(fixed.value().fields.kindLocked, true);
  await fixed.unmount();
});

test("useUserGroupFreeze: incomplete の間は同じ元で送り直し、進み具合と終わり", async () => {
  staticRounds = [
    { status: "incomplete", staged: 1000, skipped: 0 },
    { status: "incomplete", staged: 2000, skipped: 0 },
    { status: "replaced", memberCount: 2500, added: 2500, removed: 0, skipped: 3 },
  ];
  const events: string[] = [];
  const view = await mount(() =>
    hooks.useUserGroupFreeze({ onStarted: (group) => events.push(`started:${group.id}`), onDone: (group) => events.push(`done:${group.id}`) }),
  );
  const from = { type: "group", groupId: ID } as const;
  await act(async () => {
    await view.value().start({ name: "固定", from });
  });
  assert.deepEqual(calls, [
    ["static", { name: "固定", description: null, from }],
    ["members", "s1", { mode: "replace", from }],
    ["members", "s1", { mode: "replace", from }],
  ]);
  const progress = view.value().progress;
  assert.equal(progress.status, "done");
  assert.deepEqual(progress.status === "done" ? [progress.memberCount, progress.skipped] : null, [2500, 3]);
  assert.deepEqual(events, ["started:s1", "done:s1"]);
  await view.unmount();
});

test("useUserGroupEstimate: 押した時だけ数える、理由はサーバーの言葉、条件を変えたら古い見込み", async () => {
  const view = await mount(() => {
    const [definition, setDefinition] = useState<unknown>({ part: "role", args: {} });
    return { estimate: hooks.useUserGroupEstimate(definition as never), setDefinition };
  });
  const e = () => view.value().estimate;
  assert.equal(calls.length, 0, "開いただけでは数えない");
  await act(async () => e().run());
  assert.deepEqual(calls[0], ["estimate", { definition: { part: "role", args: {} } }]);
  assert.equal(e().result?.count, 2);
  assert.equal(e().stale, false);
  await act(async () => view.value().setDefinition({ part: "role", args: { roles: ["user"] } }));
  assert.equal(e().stale, true);
  estimateError = new Error("時間の上限で数えられませんでした");
  await act(async () => e().run());
  assert.equal(e().reason, "時間の上限で数えられませんでした");
  assert.equal(e().result, null);
  assert.equal(e().stale, false);
  await view.unmount();
});

test("useUserGroupStaticMembers: 要約・一覧(サブのモーダルを開いた時だけ、表示名)・足す・1 人外す(mode remove)", async () => {
  const changed: unknown[] = [];
  const view = await mount(() => hooks.useUserGroupStaticMembers({ groupId: "s1", onChanged: (group) => changed.push(group?.id ?? null) }));
  // J107: タブの中は要約(先頭 3 名)、一覧はサブのモーダルを開いている間だけ取る
  assert.deepEqual(view.value().summary.items.map((p) => p.name), ["花子", null]);
  assert.deepEqual(view.value().query.items, []);
  await act(async () => view.value().setListOpen(true));
  assert.deepEqual(view.value().query.items.map((p) => p.name), ["花子", null]);
  calls.length = 0;
  await act(async () => view.value().remove("u1"));
  // 外した後は要約を取り直す(J107)ので、最後の呼び出しではなく一員の書き込みを探す
  assert.deepEqual(calls.find((c) => c[0] === "members"), ["members", "s1", { mode: "remove", userIds: ["u1"] }]);
  assert.deepEqual(view.value().query.items.map((p) => p.id), ["u2"]);
  await act(async () => view.value().setPicks(["u3"]));
  await act(async () => view.value().add());
  assert.ok(calls.some((c) => c[0] === "members" && (c[2] as { mode: string }).mode === "add"));
  assert.deepEqual(view.value().picks, []);
  assert.deepEqual(changed, [null, "s1"]);
  await view.unmount();
});

test("useUserGroupExceptions: 側ごとの一覧、足すと両方を取り直す、外すは 1 人", async () => {
  const view = await mount(() => hooks.useUserGroupExceptions({ groupId: ID }));
  assert.deepEqual(calls.filter((c) => c[0] === "listExceptions").map((c) => c[2]).sort(), ["exclude", "include"]);
  await act(async () => view.value().include.setPicks(["u5"]));
  calls.length = 0;
  await act(async () => view.value().include.add());
  assert.deepEqual(calls.find((c) => c[0] === "exceptions"), ["exceptions", ID, { include: { add: ["u5"] } }]);
  assert.deepEqual(calls.filter((c) => c[0] === "listExceptions").map((c) => c[2]).sort(), ["exclude", "include"]);
  calls.length = 0;
  await act(async () => view.value().exclude.remove("u9"));
  // 外した後は要約を取り直す(J107)ので、最後の呼び出しではなく例外の書き込みを探す
  assert.deepEqual(calls.find((c) => c[0] === "exceptions"), ["exceptions", ID, { exclude: { remove: ["u9"] } }]);
  await view.unmount();
});

test("useAddToUserGroup: mode add で足し結果を返す、断られたらサーバーの理由", async () => {
  const view = await mount(() => hooks.useAddToUserGroup());
  let done: unknown = null;
  await act(async () => {
    done = await view.value().add("s1", ["u1", "u2"]);
  });
  assert.deepEqual(calls.at(-1), ["members", "s1", { mode: "add", userIds: ["u1", "u2"] }]);
  assert.deepEqual((done as { added: number; memberCount: number } | null) && { added: (done as { added: number }).added, memberCount: (done as { memberCount: number }).memberCount }, { added: 1, memberCount: 2 });
  assert.equal(view.value().reason, null);
  await act(async () => {
    done = await view.value().add("s1", ["over"]);
  });
  assert.equal(done, null);
  assert.equal(view.value().reason, "人数の上限を超えます");
  await act(async () => view.value().clear());
  assert.equal(view.value().reason, null);
  await view.unmount();
});

test("useUserGroupModal: 固定の進み具合は始めた開いた回だけ。閉じて「新しく作る」を開き直すと出さない", async () => {
  staticRounds = [{ status: "replaced", memberCount: 2, added: 2, removed: 0, skipped: 0 }];
  const view = await mount(() => {
    const [open, setOpen] = useState(true);
    return { modal: hooks.useUserGroupModal({ open, groupId: null }), setOpen };
  });
  await act(async () => {
    await view.value().modal.freeze.start({ name: "固定", from: { type: "users", userIds: ["u1", "u2"] } });
  });
  assert.equal(view.value().modal.freeze.progress.status, "done");
  await act(async () => view.value().setOpen(false));
  await act(async () => view.value().setOpen(true));
  assert.equal(view.value().modal.freeze.progress.status, "idle");
  assert.equal(view.value().modal.freeze.running, false);
  assert.equal(view.value().modal.mode, "create", "前の回で作ったグループを開き直しに持ち越さない");
  await view.unmount();
});
