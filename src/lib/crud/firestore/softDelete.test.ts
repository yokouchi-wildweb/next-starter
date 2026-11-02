// src/lib/crud/firestore/softDelete.test.ts
//
// useSoftDelete の作成経路が deletedAt: null を書くことの検査（実 Firestore・エミュレーター不要）。
// getServerFirestore をメモリ上の偽物に差し替える。偽物は Firestore と同じく、フィールドの無い文書を
// where(field, "==", null) に一致させない（直したバグはこの差で起きていた）。
// (package.json に type: module が無いので tsx は CJS として読む → before() で import)
import { before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";

type Data = Record<string, unknown>;

const store = new Map<string, Map<string, Data>>();
const docsOf = (path: string): Map<string, Data> => {
  let docs = store.get(path);
  if (!docs) store.set(path, (docs = new Map()));
  return docs;
};

const snapshotOf = (path: string, id: string) => {
  const data = docsOf(path).get(id);
  return {
    id,
    exists: data !== undefined,
    data: () => (data ? { ...data } : undefined),
    get: (field: string) => data?.[field],
  };
};

const docRef = (path: string, id: string) => ({
  id,
  path,
  get: async () => snapshotOf(path, id),
  set: async (data: Data, setOptions?: { merge?: boolean }) => writeDoc(path, id, data, setOptions),
  delete: async () => void docsOf(path).delete(id),
});
type Ref = ReturnType<typeof docRef>;

const writeDoc = (path: string, id: string, data: Data, setOptions?: { merge?: boolean }) => {
  const docs = docsOf(path);
  docs.set(id, setOptions?.merge ? { ...(docs.get(id) ?? {}), ...data } : { ...data });
};

type Filter = { field: string; op: string; value: unknown };
const matches = (data: Data, filter: Filter): boolean => {
  // Firestore: フィールドの無い文書はどの条件にも一致しない（== null も含む）
  if (!Object.prototype.hasOwnProperty.call(data, filter.field)) return false;
  const actual = data[filter.field];
  if (filter.op === "==") return actual === filter.value;
  throw new Error(`fake: op ${filter.op} is not supported`);
};

const query = (path: string, filters: Filter[] = [], max?: number): any => ({
  where: (field: string, op: string, value: unknown) => query(path, [...filters, { field, op, value }], max),
  orderBy: () => query(path, filters, max),
  limit: (n: number) => query(path, filters, n),
  get: async () => {
    const docs = [...docsOf(path).entries()]
      .filter(([, data]) => filters.every((filter) => matches(data, filter)))
      .slice(0, max)
      .map(([id]) => snapshotOf(path, id));
    return { docs, empty: docs.length === 0 };
  },
  count: () => ({
    get: async () => {
      const { docs } = await query(path, filters).get();
      return { data: () => ({ count: docs.length }) };
    },
  }),
});

let autoId = 0;
const fakeDb = {
  collection: (path: string) => ({
    ...query(path),
    doc: (id?: string) => docRef(path, id ?? `auto-${++autoId}`),
  }),
  batch: () => {
    const ops: (() => void)[] = [];
    return {
      set: (ref: Ref, data: Data, setOptions?: { merge?: boolean }) => void ops.push(() => writeDoc(ref.path, ref.id, data, setOptions)),
      delete: (ref: Ref) => void ops.push(() => docsOf(ref.path).delete(ref.id)),
      commit: async () => ops.forEach((op) => op()),
    };
  },
  getAll: async (...refs: Ref[]) => refs.map((ref) => snapshotOf(ref.path, ref.id)),
  runTransaction: async (work: (transaction: unknown) => Promise<void>) => {
    const ops: (() => void)[] = [];
    await work({
      getAll: async (...refs: Ref[]) => refs.map((ref) => snapshotOf(ref.path, ref.id)),
      set: (ref: Ref, data: Data, setOptions?: { merge?: boolean }) => void ops.push(() => writeDoc(ref.path, ref.id, data, setOptions)),
    });
    ops.forEach((op) => op());
  },
};

mock.module("@/lib/firebase/server/app", { namedExports: { getServerFirestore: () => fakeDb } });

let createCrudService: typeof import("./index").createCrudService;
before(async () => {
  ({ createCrudService } = await import("./index"));
});
beforeEach(() => store.clear());

const SOFT = "soft_items";
const PLAIN = "plain_items";
const soft = () => createCrudService<{ id?: string; name?: string; deletedAt?: unknown }>(SOFT, { idType: "uuid", useSoftDelete: true });
const plain = () => createCrudService<{ id?: string; name?: string; deletedAt?: unknown }>(PLAIN, { idType: "uuid" });
const stored = (path: string, id: string) => docsOf(path).get(id);
const visibleIds = async (service: ReturnType<typeof soft>) => ({
  list: (await service.list()).map((row) => row.id).sort(),
  search: (await service.search()).results.map((row) => row.id).sort(),
  count: (await service.count()).total,
});

test("useSoftDelete の create は deletedAt: null を書き、list / search / count に出る", async () => {
  const service = soft();
  const created = await service.create({ name: "a" });
  assert.equal(stored(SOFT, created.id!)?.deletedAt, null);
  assert.deepEqual(await visibleIds(service), { list: [created.id], search: [created.id], count: 1 });

  await service.remove(created.id!);
  assert.deepEqual(await visibleIds(service), { list: [], search: [], count: 0 });
});

test("useSoftDelete の無い create は deletedAt を書かない", async () => {
  const created = await plain().create({ name: "a" });
  assert.equal(Object.prototype.hasOwnProperty.call(stored(PLAIN, created.id!), "deletedAt"), false);
});

test("duplicate の行も削除されていない行として出る", async () => {
  const service = soft();
  const created = await service.create({ name: "a" });
  const copy = await service.duplicate(created.id!);
  assert.equal(stored(SOFT, copy.id!)?.deletedAt, null);
  assert.equal((await service.count()).total, 2);
});

test("upsert: 新規は null、論理削除済みは削除のまま、deletedAt の無い古い行は null になる", async () => {
  const service = soft();
  const fresh = await service.upsert({ id: "new", name: "a" });
  assert.equal(stored(SOFT, fresh.id!)?.deletedAt, null);

  await service.remove("new");
  await service.upsert({ id: "new", name: "b" });
  assert.ok(stored(SOFT, "new")?.deletedAt instanceof Date, "upsert は復元しない");
  assert.equal(stored(SOFT, "new")?.name, "b");

  docsOf(SOFT).set("legacy", { id: "legacy", name: "old" });
  await service.upsert({ id: "legacy", name: "old2" });
  assert.equal(stored(SOFT, "legacy")?.deletedAt, null);
  assert.deepEqual((await visibleIds(service)).list, ["legacy"]);
});

test("bulkUpsert: upsert と同じ規則で、useSoftDelete の無いサービスは deletedAt を書かない", async () => {
  const service = soft();
  await service.upsert({ id: "deleted", name: "d" });
  await service.remove("deleted");
  docsOf(SOFT).set("legacy", { id: "legacy", name: "old" });

  const result = await service.bulkUpsert([
    { id: "new", name: "n" },
    { id: "deleted", name: "d2" },
    { id: "legacy", name: "l2" },
  ]);
  assert.equal(result.count, 3);
  assert.equal(stored(SOFT, "new")?.deletedAt, null);
  assert.ok(stored(SOFT, "deleted")?.deletedAt instanceof Date);
  assert.equal(stored(SOFT, "legacy")?.deletedAt, null);
  assert.deepEqual((await visibleIds(service)).list, ["legacy", "new"]);

  await plain().bulkUpsert([{ id: "p", name: "p" }]);
  assert.equal(Object.prototype.hasOwnProperty.call(stored(PLAIN, "p"), "deletedAt"), false);
});

test("入力に deletedAt があればそれを使う", async () => {
  const service = soft();
  const when = new Date("2026-01-01T00:00:00Z");
  const created = await service.create({ name: "a", deletedAt: when });
  assert.equal(stored(SOFT, created.id!)?.deletedAt, when);
});
