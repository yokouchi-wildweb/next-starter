// 利用者ごとの履歴の検査(DB は偽物)
// - DTO: 決めた項目だけ(本文・宛先・provider の値・誤りの文は出ない)、前の送る口の送信(message_key null)
// - 新しい順の keyset: 印で続きを読み、最後は nextCursor null
// - 不正な利用者 id・cursor・limit は 400、居ない利用者は 404
// - 共有のお知らせ(全員・ロール): 受け取り箱に見える行だけが混ざり(規則の写し isVisible で絞る偽物)、配達と時刻で 1 本に並び、印は 1 つ
// 実行: pnpm test src/domains/core/messaging/services/server/history
import { test } from "node:test";
import assert from "node:assert/strict";

import { DomainError } from "@/lib/errors";
import type { MessageKind } from "@/lib/messaging";

import type { AdminCursor } from "../admin/readDispatches";
import { isVisible, type InboxViewer, type VisibilityFacts } from "../inbox/visibility";
import { listUserMessageHistory, type UserHistoryRow, type UserHistoryStore, type UserSharedInAppRow } from "./userHistory";

const USER = "00000000-0000-4000-8000-000000000001";

function row(n: number, overrides: { oldSend?: boolean } = {}): UserHistoryRow {
  return {
    delivery: {
      id: `00000000-0000-4000-8000-0000000001${String(n).padStart(2, "0")}`,
      channel: n % 2 === 0 ? "email" : "inApp",
      status: "sent",
      sent_at: new Date(Date.UTC(2026, 0, 1, 0, n, 30)),
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, n)),
    },
    dispatch: {
      id: `00000000-0000-4000-8000-0000000002${String(n).padStart(2, "0")}`,
      message_key: overrides.oldSend ? null : "user.welcome",
      kind: overrides.oldSend ? null : "transactional",
      source: "test",
      headings: overrides.oldSend ? { email: "写した件名" } : { email: `件名${n}` },
    },
  };
}

/** 共有のお知らせの行と、見えるかの材料(偽物が規則の写しで絞る) */
type SharedFixture = {
  row: UserSharedInAppRow;
  item: Omit<VisibilityFacts["item"], "publishedAt">;
  dispatch: VisibilityFacts["dispatch"];
};

function shared(
  n: number,
  overrides: { targetRoles?: string[] | null; showToLaterSignups?: boolean; kind?: MessageKind } = {},
): SharedFixture {
  const kind = overrides.kind ?? "announcement";
  const id = `00000000-0000-4000-8000-0000000003${String(n).padStart(2, "0")}`;
  return {
    row: {
      item: { id, published_at: new Date(Date.UTC(2026, 0, 1, 0, n)) },
      dispatch: {
        id: `00000000-0000-4000-8000-0000000004${String(n).padStart(2, "0")}`,
        message_key: null,
        kind,
        source: "adminSend",
        headings: { inApp: `お知らせ${n}` },
      },
    },
    item: { userId: null, targetRoles: overrides.targetRoles ?? null },
    dispatch: { showToLaterSignups: overrides.showToLaterSignups ?? true, kind, category: kind, groupRow: null },
  };
}

const NOW = new Date(Date.UTC(2027, 0, 1));

function after(key: { createdAt: Date; id: string }, cursor: AdminCursor | null): boolean {
  if (!cursor) return true;
  const diff = key.createdAt.getTime() - cursor.createdAt.getTime();
  return diff < 0 || (diff === 0 && key.id < cursor.id);
}

type Call = { userId: string; after: AdminCursor | null; limit: number };

/** 新しい順の行を持つ偽物(after より古い行を limit 件)。共有の行は規則の写し isVisible で見える物だけ */
function fakeStore(
  rows: UserHistoryRow[],
  options: {
    sharedRows?: SharedFixture[];
    viewer?: Partial<Omit<VisibilityFacts["viewer"], "userId">> | null;
  } = {},
): UserHistoryStore & { calls: Call[] } {
  const sorted = [...rows].sort((a, b) => b.delivery.createdAt.getTime() - a.delivery.createdAt.getTime());
  const sharedSorted = [...(options.sharedRows ?? [])].sort(
    (a, b) => b.row.item.published_at.getTime() - a.row.item.published_at.getTime(),
  );
  const facts: VisibilityFacts["viewer"] | null =
    options.viewer === null ? null : { userId: USER, role: "user", createdAt: new Date(Date.UTC(2025, 0, 1)), optOuts: [], ...options.viewer };
  const calls: Call[] = [];
  return {
    calls,
    async findViewer(userId) {
      return facts && userId === facts.userId ? ({ userId, role: facts.role } satisfies InboxViewer) : null;
    },
    async listUserDeliveries(userId, cursor, limit) {
      calls.push({ userId, after: cursor, limit });
      return sorted.filter((r) => after(r.delivery, cursor)).slice(0, limit);
    },
    async listSharedInApp(viewer, cursor, limit) {
      assert.ok(facts);
      assert.equal(viewer.userId, facts.userId);
      return sharedSorted
        .filter((s) => isVisible({ viewer: facts, item: { ...s.item, publishedAt: s.row.item.published_at }, dispatch: s.dispatch, now: NOW }))
        .filter((s) => after({ createdAt: s.row.item.published_at, id: s.row.item.id }, cursor))
        .map((s) => s.row)
        .slice(0, limit);
    },
  };
}

async function rejects400(promise: Promise<unknown>) {
  await assert.rejects(promise, (error: unknown) => error instanceof DomainError && error.status === 400);
}

test("DTO: 決めた項目だけを返す(本文・宛先・provider の値は出ない)", async () => {
  const store = fakeStore([row(2)]);
  const page = await listUserMessageHistory({ store }, USER);
  assert.deepEqual(page, {
    items: [
      {
        type: "delivery",
        dispatchId: "00000000-0000-4000-8000-000000000202",
        messageKey: "user.welcome",
        kind: "transactional",
        source: "test",
        channel: "email",
        status: "sent",
        headings: { email: "件名2" },
        createdAt: "2026-01-01T00:02:00.000Z",
        sentAt: "2026-01-01T00:02:30.000Z",
      },
    ],
    nextCursor: null,
  });
  assert.equal(store.calls[0].userId, USER);
  assert.equal(store.calls[0].limit, 51);
});

test("DTO: 前の送る口の送信は message_key null、件名・題は写しが移した headings", async () => {
  const page = await listUserMessageHistory({ store: fakeStore([row(1, { oldSend: true })]) }, USER);
  assert.equal(page.items[0].messageKey, null);
  assert.deepEqual(page.items[0].headings, { email: "写した件名" });
});

test("新しい順の keyset: 印で続きを読み、最後は nextCursor null", async () => {
  const store = fakeStore([1, 2, 3, 4, 5].map((n) => row(n)));
  const first = await listUserMessageHistory({ store }, USER, { limit: 2 });
  assert.deepEqual(first.items.map((i) => i.createdAt.slice(14, 16)), ["05", "04"]);
  assert.ok(first.nextCursor);
  const second = await listUserMessageHistory({ store }, USER, { limit: 2, cursor: first.nextCursor! });
  assert.deepEqual(second.items.map((i) => i.createdAt.slice(14, 16)), ["03", "02"]);
  const third = await listUserMessageHistory({ store }, USER, { limit: 2, cursor: second.nextCursor! });
  assert.deepEqual(third.items.map((i) => i.createdAt.slice(14, 16)), ["01"]);
  assert.equal(third.nextCursor, null);
});

test("不正な利用者 id・cursor・limit は 400", async () => {
  const store = fakeStore([]);
  await rejects400(listUserMessageHistory({ store }, "not-a-uuid"));
  await rejects400(listUserMessageHistory({ store }, USER, { cursor: "bad" }));
  await rejects400(listUserMessageHistory({ store }, USER, { limit: 0 }));
  await rejects400(listUserMessageHistory({ store }, USER, { limit: 101 }));
  assert.equal(store.calls.length, 0);
});

test("居ない利用者は 404", async () => {
  const store = fakeStore([], { viewer: null });
  await assert.rejects(listUserMessageHistory({ store }, USER), (error: unknown) => error instanceof DomainError && error.status === 404);
  assert.equal(store.calls.length, 0);
});

test("共有のお知らせ: 見える行は配達と時刻の順に混ざり、配達の状態は null", async () => {
  const page = await listUserMessageHistory({ store: fakeStore([row(1), row(3)], { sharedRows: [shared(2)] }) }, USER);
  assert.deepEqual(page.items.map((i) => [i.type, i.createdAt.slice(14, 16)]), [
    ["delivery", "03"],
    ["sharedInApp", "02"],
    ["delivery", "01"],
  ]);
  assert.deepEqual(page.items[1], {
    type: "sharedInApp",
    dispatchId: "00000000-0000-4000-8000-000000000402",
    messageKey: null,
    kind: "announcement",
    source: "adminSend",
    channel: "inApp",
    status: null,
    headings: { inApp: "お知らせ2" },
    createdAt: "2026-01-01T00:02:00.000Z",
    sentAt: null,
  });
});

test("共有のお知らせ: 規則で隠れる行(別のロール・登録より前で後の登録に見せない・止めた)は出ない", async () => {
  const sharedRows = [
    shared(1, { targetRoles: ["user"] }),
    shared(2, { targetRoles: ["admin"] }),
    shared(3, { showToLaterSignups: false }),
    shared(4),
  ];
  const visible = await listUserMessageHistory(
    { store: fakeStore([], { sharedRows, viewer: { createdAt: new Date(Date.UTC(2026, 0, 1, 0, 3, 30)) } }) },
    USER,
  );
  assert.deepEqual(visible.items.map((i) => i.createdAt.slice(14, 16)), ["04", "01"]);

  const optedOut = await listUserMessageHistory(
    { store: fakeStore([], { sharedRows: [shared(4, { kind: "promotion" })], viewer: { optOuts: [{ category: "promotion", channel: "inApp" }] } }) },
    USER,
  );
  assert.deepEqual(optedOut.items, []);
});

test("共有のお知らせと配達の 1 つの印: 両方に同じ線を引き、重なりも抜けも無い", async () => {
  const store = fakeStore([row(1), row(4), row(5)], { sharedRows: [shared(2), shared(3), shared(6)] });
  const seen: string[] = [];
  let cursor: string | undefined;
  for (let n = 0; n < 5; n++) {
    const page = await listUserMessageHistory({ store }, USER, { limit: 2, cursor });
    seen.push(...page.items.map((i) => `${i.type}:${i.createdAt.slice(14, 16)}`));
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  assert.deepEqual(seen, [
    "sharedInApp:06",
    "delivery:05",
    "delivery:04",
    "sharedInApp:03",
    "sharedInApp:02",
    "delivery:01",
  ]);
});
