// 旧お知らせの写し(messaging:copy-legacy-notifications)の検査。DB には触らない(メモリの置き場 = 本物の SQL の規則の写し)
// - 列の対応(全員・ロールは共有の 1 行、個人宛ては宛先ごと、消えた利用者・形の崩れた id は写さず数える、既読は行き着く行へ、
//   watermark、テンプレートの key・状態・版、未来の公開の時刻、silent、回の status・expand_cursor・source・tags)
// - 冪等(二度目は何も増えない)、予算で止まれば incomplete、続きから終わる、照合の食い違いは打ち直せる失敗
// 実行: pnpm test src/features/core/messaging/scripts/migrations
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import { isTaskIncomplete } from "@/lib/task";

import { task, LEGACY_COPY_NOTICE_ID } from "./copy-legacy-notifications";
import { type LegacyCopyCounts, type LegacyCopyStore, reconcile, runLegacyCopy } from "./lib.legacyCopy";
import {
  type DispatchFill,
  type DispatchInsert,
  type ItemInsert,
  type LegacyDispatchRow,
  type LegacyNotificationRow,
  type LegacyReadStateRow,
  type LegacyTemplateRow,
  type ReadInsert,
  type TemplateInsert,
  type TemplateVersionInsert,
  LEGACY_DISPATCH_SOURCE,
  isUuid,
  legacyReadItemId,
  legacyRecipientItemId,
  mapDispatchFill,
  mapNotification,
  mapTemplate,
} from "./lib.legacyCopyMap";

const NOW = new Date("2026-11-11T12:00:00Z");
const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const nid = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const tid = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const notification = (over: Partial<LegacyNotificationRow> & { id: string }): LegacyNotificationRow => ({
  notificationTemplateId: null,
  title: "題",
  body: "本文",
  image: null,
  targetType: "all",
  targetUserIds: null,
  targetRoles: null,
  senderType: "admin",
  createdById: uid(9),
  metadata: null,
  isSilent: false,
  publishedAt: new Date("2026-11-01T00:00:00Z"),
  createdAt: new Date("2026-10-31T00:00:00Z"),
  updatedAt: null,
  ...over,
});

// ---- 列の対応 ----

test("個人宛ての行の id は md5(<お知らせ>:<利用者>) の uuid の形(SQL の md5(...)::uuid と同じ)", () => {
  const hex = createHash("md5").update(`${nid(1)}:${uid(1)}`).digest("hex");
  const id = legacyRecipientItemId(nid(1), uid(1));
  assert.equal(id.replaceAll("-", ""), hex);
  assert.ok(isUuid(id));
  assert.equal(legacyRecipientItemId(nid(1).toUpperCase(), uid(1)), id, "大文字でも同じ(SQL の uuid::text は小文字)");
  assert.equal(legacyReadItemId(nid(1), "all", uid(1)), nid(1));
  assert.equal(legacyReadItemId(nid(1), "individual", uid(1)), id);
});

test("全員宛て: 回 1 つ + 共有の 1 行。回は completed・'~done'・source legacy.notification・tags legacy・cron に拾われない", () => {
  const { dispatch, items, skippedRecipients } = mapNotification(notification({ id: nid(1), notificationTemplateId: tid(1) }), new Set(), NOW);
  assert.deepEqual(
    [dispatch.id, dispatch.status, dispatch.expand_cursor, dispatch.source, dispatch.tags, dispatch.channels, dispatch.template_id],
    [nid(1), "completed", "~done", LEGACY_DISPATCH_SOURCE, ["legacy"], ["inApp"], tid(1)],
  );
  assert.deepEqual(dispatch.audience, { type: "all" });
  assert.equal(dispatch.show_to_later_signups, false, "前の規則 = 登録より前のお知らせは見せない");
  assert.deepEqual([dispatch.actor_type, dispatch.actor_id], ["admin", uid(9)]);
  assert.deepEqual(dispatch.metadata, { legacyNotificationId: nid(1) });
  assert.equal(skippedRecipients, 0);
  assert.equal(items.length, 1);
  assert.deepEqual([items[0]!.id, items[0]!.user_id, items[0]!.target_roles, items[0]!.dispatch_id], [nid(1), null, null, nid(1)]);
  assert.deepEqual(items[0]!.metadata, { legacyNotificationId: nid(1) });
});

test("ロール宛て: 共有の 1 行に target_roles、audience role", () => {
  const { dispatch, items } = mapNotification(notification({ id: nid(2), targetType: "role", targetRoles: ["user"] }), new Set(), NOW);
  assert.deepEqual(dispatch.audience, { type: "role", roles: ["user"] });
  assert.deepEqual(items.map((i) => [i.user_id, i.target_roles]), [[null, ["user"]]]);
});

test("個人宛て: 今いる利用者ごとに 1 行(重なりは 1 行)、消えた利用者・形の崩れた id は写さず数える", () => {
  const row = notification({ id: nid(3), targetType: "individual", targetUserIds: [uid(1), uid(1).toUpperCase(), uid(2), uid(3), "not-a-uuid"] });
  const { dispatch, items, skippedRecipients } = mapNotification(row, new Set([uid(1), uid(2)]), NOW);
  assert.deepEqual(items.map((i) => [i.id, i.user_id]), [
    [legacyRecipientItemId(nid(3), uid(1)), uid(1)],
    [legacyRecipientItemId(nid(3), uid(2)), uid(2)],
  ]);
  assert.equal(skippedRecipients, 2);
  assert.deepEqual(dispatch.audience, { type: "recipients", count: 2 });
  assert.equal(dispatch.recipient_count, 2);
  assert.deepEqual(dispatch.channel_counts.inApp, { targeted: 2, sent: 2, failed: 0, skipped_no_address: 0, skipped_throttled: 0, suppressed: 0 });
});

test("silent は行の metadata に silent: true、元の metadata は残す。未来の公開の時刻はそのまま(回は completed)", () => {
  const future = new Date("2027-01-01T00:00:00Z");
  const { dispatch, items } = mapNotification(notification({ id: nid(4), isSilent: true, metadata: { link: "/x" }, publishedAt: future }), new Set(), NOW);
  assert.deepEqual(items[0]!.metadata, { link: "/x", legacyNotificationId: nid(4), silent: true });
  assert.equal(items[0]!.published_at, future);
  assert.deepEqual([dispatch.status, dispatch.expand_cursor], ["completed", "~done"]);
});

test("テンプレート: id はそのまま、key legacy-<id>、category marketing、status draft、版 1、内容は inApp だけ。形の合わない variables は落として説明に残す", () => {
  const row: LegacyTemplateRow = { id: tid(1), name: "名", title: "題", body: "本文", variables: ["name"], category: "system", createdAt: null, updatedAt: null };
  const { template, version } = mapTemplate(row, NOW);
  assert.deepEqual(
    [template.id, template.key, template.category, template.status, template.current_version, template.channels],
    [tid(1), `legacy-${tid(1)}`, "marketing", "draft", 1, ["inApp"]],
  );
  assert.deepEqual(template.content, { inApp: { title: "題", body: "本文" } });
  assert.deepEqual(template.variables, []);
  assert.match(template.description ?? "", /旧 category: system/);
  assert.match(template.description ?? "", /\["name"\]/);
  assert.deepEqual([version.template_id, version.version, version.content], [tid(1), 1, template.content]);
  const ok = [{ key: "name", label: "名前", type: "text", required: true, source: "recipient" }];
  assert.deepEqual(mapTemplate({ ...row, variables: ok }, NOW).template.variables, ok);
});

test("古い送る口の回: 古い列 → headings・rendered・channel_counts", () => {
  const fill = mapDispatchFill({
    id: "d1",
    channels: ["email", "inApp"],
    emailSubject: "件名",
    emailBody: "<p>本文</p>",
    notificationTitle: "題",
    notificationBody: "お知らせ",
    recipientCount: 5,
    emailSuccessCount: 4,
    emailFailedCount: 1,
    notificationCreated: true,
  });
  assert.deepEqual(fill.headings, { email: "件名", inApp: "題" });
  assert.deepEqual(fill.rendered, { email: { subject: "件名", paragraphs: ["<p>本文</p>"] }, inApp: { title: "題", body: "お知らせ" } });
  assert.deepEqual([fill.channel_counts.email?.targeted, fill.channel_counts.email?.sent, fill.channel_counts.email?.failed], [5, 4, 1]);
  assert.deepEqual([fill.channel_counts.inApp?.targeted, fill.channel_counts.inApp?.sent], [5, 5]);
  const emailOnly = mapDispatchFill({ id: "d2", channels: ["email"], emailSubject: "s", emailBody: null, notificationTitle: null, notificationBody: null, recipientCount: 1, emailSuccessCount: 1, emailFailedCount: 0, notificationCreated: null });
  assert.deepEqual(Object.keys(emailOnly.channel_counts), ["email"]);
});

// ---- 流れ(メモリの置き場) ----

type World = {
  users: Set<string>;
  templates: LegacyTemplateRow[];
  notifications: LegacyNotificationRow[];
  reads: { notificationId: string; userId: string; readAt: Date }[];
  readStates: LegacyReadStateRow[];
  oldDispatches: (LegacyDispatchRow & { filled: DispatchFill | null })[];
};

function memoryStore(world: World, delayMs = 0) {
  const newTemplates = new Map<string, TemplateInsert>();
  const newVersions = new Map<string, TemplateVersionInsert>();
  const dispatches = new Map<string, DispatchInsert>();
  const items = new Map<string, ItemInsert>();
  const reads = new Map<string, ReadInsert>();
  const states = new Map<string, Date | null>();
  const wait = () => (delayMs > 0 ? new Promise((resolve) => setTimeout(resolve, delayMs)) : Promise.resolve());
  const byId = <T extends { id: string }>(rows: T[]) => [...rows].sort((a, b) => (a.id < b.id ? -1 : 1));
  const targetOf = (notificationId: string) => world.notifications.find((n) => n.id === notificationId)!.targetType;

  const store: LegacyCopyStore = {
    async legacyTablesExist() {
      return true;
    },
    async nextTemplates(after, limit) {
      return byId(world.templates).filter((t) => (!after || t.id > after) && !newTemplates.has(t.id)).slice(0, limit);
    },
    async writeTemplates(rows) {
      await wait();
      for (const { template, version } of rows) {
        if (!newTemplates.has(template.id)) newTemplates.set(template.id, template);
        const key = `${version.template_id}|${version.version}`;
        if (!newVersions.has(key)) newVersions.set(key, version);
      }
    },
    async nextNotifications(after, limit) {
      return byId(world.notifications).filter((n) => (!after || n.id > after) && !dispatches.has(n.id)).slice(0, limit);
    },
    async existingUserIds(ids) {
      return new Set(ids.filter((id) => world.users.has(id)));
    },
    async writeNotifications(rows) {
      await wait();
      for (const { dispatch, items: rowItems } of rows) {
        if (!dispatches.has(dispatch.id)) dispatches.set(dispatch.id, dispatch);
        for (const item of rowItems) if (!items.has(item.id)) items.set(item.id, item);
      }
    },
    async nextReads(after, limit) {
      const key = (r: { notificationId: string; userId: string }) => `${r.notificationId}|${r.userId}`;
      return [...world.reads]
        .sort((a, b) => (key(a) < key(b) ? -1 : 1))
        .filter((r) => !after || key(r) > key(after))
        .map((r) => ({ ...r, targetType: targetOf(r.notificationId) }))
        .filter((r) => !reads.has(`${legacyReadItemId(r.notificationId, r.targetType, r.userId)}|${r.userId}`))
        .slice(0, limit);
    },
    async existingItemIds(ids) {
      return new Set(ids.filter((id) => items.has(id)));
    },
    async writeReads(rows) {
      await wait();
      for (const row of rows) {
        const key = `${row.item_id}|${row.user_id}`;
        if (!reads.has(key)) reads.set(key, row);
      }
    },
    async nextReadStates(after, limit) {
      return [...world.readStates]
        .sort((a, b) => (a.userId < b.userId ? -1 : 1))
        .filter((s) => !after || s.userId > after)
        .filter((s) => {
          if (!states.has(s.userId)) return true;
          const current = states.get(s.userId) ?? null;
          return !(s.readWatermarkAt === null || (current !== null && current >= s.readWatermarkAt));
        })
        .slice(0, limit);
    },
    async writeReadStates(rows) {
      await wait();
      for (const row of rows) {
        const current = states.get(row.user_id) ?? null;
        const next = row.read_watermark_at;
        states.set(row.user_id, current === null ? next : next === null ? current : current > next ? current : next);
      }
    },
    async nextDispatchFills(after, limit) {
      return byId(world.oldDispatches).filter((d) => (!after || d.id > after) && d.filled === null).slice(0, limit);
    },
    async writeDispatchFills(rows) {
      await wait();
      for (const row of rows) {
        const target = world.oldDispatches.find((d) => d.id === row.id)!;
        if (target.filled === null) target.filled = row;
      }
    },
    async counts(): Promise<LegacyCopyCounts> {
      const shared = world.notifications.filter((n) => n.targetType !== "individual").length;
      const recipients = world.notifications.flatMap((n) =>
        n.targetType === "individual" ? [...new Set((n.targetUserIds ?? []).map((id) => id.toLowerCase()))].map((u) => ({ n: n.id, u })) : [],
      );
      const valid = recipients.filter((r) => isUuid(r.u) && world.users.has(r.u));
      const readTargets = world.reads.map((r) => ({ userId: r.userId, itemId: legacyReadItemId(r.notificationId, targetOf(r.notificationId), r.userId) }));
      const legacyItems = [...items.values()].filter((i) => dispatches.get(i.dispatch_id)?.source === LEGACY_DISPATCH_SOURCE);
      const withItem = readTargets.filter((r) => items.has(r.itemId));
      return {
        templates: { source: world.templates.length, expected: world.templates.length, copied: world.templates.filter((t) => newTemplates.get(t.id)?.key === `legacy-${t.id}`).length },
        templateVersions: { source: world.templates.length, expected: world.templates.length, copied: world.templates.filter((t) => newVersions.has(`${t.id}|1`)).length },
        dispatches: { source: world.notifications.length, expected: world.notifications.length, copied: world.notifications.filter((n) => dispatches.has(n.id)).length },
        items: { source: shared + recipients.length, expected: shared + valid.length, copied: legacyItems.length, skipped: recipients.length - valid.length },
        reads: { source: world.reads.length, expected: withItem.length, copied: readTargets.filter((r) => reads.has(`${r.itemId}|${r.userId}`)).length, skipped: readTargets.length - withItem.length },
        readStates: {
          source: world.readStates.length,
          expected: world.readStates.length,
          copied: world.readStates.filter((s) => states.has(s.userId) && (s.readWatermarkAt === null || (states.get(s.userId) ?? new Date(0)) >= s.readWatermarkAt)).length,
        },
        dispatchFill: { source: world.oldDispatches.length, expected: world.oldDispatches.length, copied: world.oldDispatches.filter((d) => d.filled !== null).length },
      };
    },
  };
  return { store, newTemplates, dispatches, items, reads, states };
}

function world(): World {
  return {
    users: new Set([uid(1), uid(2), uid(3)]),
    templates: [{ id: tid(1), name: "t", title: "題", body: "本文", variables: null, category: "manual", createdAt: null, updatedAt: null }],
    notifications: [
      notification({ id: nid(1), notificationTemplateId: tid(1) }),
      notification({ id: nid(2), targetType: "role", targetRoles: ["user"] }),
      notification({ id: nid(3), targetType: "individual", targetUserIds: [uid(1), uid(2), uid(8), "x"] }),
      notification({ id: nid(4), isSilent: true, publishedAt: new Date("2027-01-01T00:00:00Z") }),
    ],
    reads: [
      { notificationId: nid(1), userId: uid(1), readAt: NOW },
      { notificationId: nid(3), userId: uid(2), readAt: NOW },
      { notificationId: nid(3), userId: uid(3), readAt: NOW }, // 宛先に入っていない人の既読 = 行き先が無い
    ],
    readStates: [
      { userId: uid(1), readWatermarkAt: new Date("2026-11-05T00:00:00Z"), updatedAt: null },
      { userId: uid(2), readWatermarkAt: null, updatedAt: null },
    ],
    oldDispatches: [
      { id: "d1", channels: ["email"], emailSubject: "s", emailBody: "b", notificationTitle: null, notificationBody: null, recipientCount: 2, emailSuccessCount: 2, emailFailedCount: 0, notificationCreated: null, filled: null },
    ],
  };
}

test("task: 名前・notice(仮の id は notice の指令が書き換える)", () => {
  assert.equal(task.name, "messaging:copy-legacy-notifications");
  assert.equal(task.notice, LEGACY_COPY_NOTICE_ID);
});

test("全部写して照合が合う。二度目は何も増えない(冪等)", async () => {
  const w = world();
  const mem = memoryStore(w);
  const first = await runLegacyCopy(mem.store, { dryRun: false, budgetMs: 60_000, now: () => NOW });
  assert.equal(isTaskIncomplete(first), false);
  assert.deepEqual(first.reconciliation, { ok: true, mismatched: [] });
  assert.deepEqual(first.skipped, { recipients: 2, reads: 1 });
  assert.deepEqual([mem.dispatches.size, mem.items.size, mem.reads.size, mem.newTemplates.size], [4, 5, 2, 1]);
  assert.ok(mem.reads.has(`${nid(1)}|${uid(1)}`));
  assert.ok(mem.reads.has(`${legacyRecipientItemId(nid(3), uid(2))}|${uid(2)}`));
  assert.equal(w.oldDispatches[0]!.filled?.headings.email, "s");
  const second = await runLegacyCopy(mem.store, { dryRun: false, budgetMs: 60_000, now: () => NOW });
  assert.deepEqual(second.copied, { templates: 0, notifications: 0, reads: 1, readStates: 0, dispatchFill: 0 }, "行き先の無い既読だけをもう一度見る");
  assert.deepEqual([mem.dispatches.size, mem.items.size, mem.reads.size], [4, 5, 2]);
  assert.deepEqual(second.reconciliation, { ok: true, mismatched: [] });
});

test("写し先に新しい watermark があれば大きい方を残す", async () => {
  const mem = memoryStore(world());
  mem.states.set(uid(1), new Date("2026-11-10T00:00:00Z"));
  await runLegacyCopy(mem.store, { dryRun: false, budgetMs: 60_000, now: () => NOW });
  assert.deepEqual(mem.states.get(uid(1)), new Date("2026-11-10T00:00:00Z"));
  assert.equal(mem.states.has(uid(2)), true);
});

test("予算で止まれば incomplete(止まった段と写した数)、打ち直すと続きから終わる", async () => {
  const mem = memoryStore(world(), 25);
  const results: Record<string, unknown>[] = [];
  for (let i = 0; i < 50; i += 1) {
    const result = await runLegacyCopy(mem.store, { dryRun: false, budgetMs: 10, chunk: 1, now: () => NOW });
    results.push(result);
    if (!isTaskIncomplete(result)) break;
  }
  assert.ok(results.length > 1, "1 回では終わらない");
  assert.ok(typeof results[0]!.stoppedAt === "string");
  const last = results[results.length - 1]!;
  assert.equal(isTaskIncomplete(last), false);
  assert.deepEqual(last.reconciliation, { ok: true, mismatched: [] });
  assert.deepEqual([mem.dispatches.size, mem.items.size, mem.reads.size], [4, 5, 2]);
});

test("dry-run は書かずに数えるだけ", async () => {
  const mem = memoryStore(world());
  const result = await runLegacyCopy(mem.store, { dryRun: true, budgetMs: 60_000, now: () => NOW });
  assert.equal(result.dryRun, true);
  assert.equal(mem.dispatches.size, 0);
  assert.equal((result.counts as LegacyCopyCounts).items.expected, 5);
});

test("照合が合わなければ TaskRerunnableError(failed・鍵を取らない)で、数を result に持つ", async () => {
  const mem = memoryStore(world());
  const counts = mem.store.counts.bind(mem.store);
  mem.store.counts = async () => {
    const real = await counts();
    return { ...real, items: { ...real.items, copied: real.items.copied - 1 } };
  };
  await assert.rejects(runLegacyCopy(mem.store, { dryRun: false, budgetMs: 60_000, now: () => NOW }), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(error.name, "TaskRerunnableError");
    assert.match(error.message, /items/);
    assert.deepEqual(((error as Error & { result?: { reconciliation?: unknown } }).result?.reconciliation), { ok: false, mismatched: ["items"] });
    return true;
  });
});

test("reconcile: expected と copied が全部等しい時だけ ok", () => {
  const line = { source: 1, expected: 1, copied: 1 };
  const all = { templates: line, templateVersions: line, dispatches: line, items: line, reads: line, readStates: line, dispatchFill: line };
  assert.deepEqual(reconcile(all), { ok: true, mismatched: [] });
  assert.deepEqual(reconcile({ ...all, reads: { source: 2, expected: 1, copied: 0 } }), { ok: false, mismatched: ["reads"] });
});
