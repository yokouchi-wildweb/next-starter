// 管理の回の操作の検査(DB・定義・送る口・監査は偽物。store の規則は operationsStore.ts と同じ)
// - d1 削除(D88、取り消し・取り下げの置き換え): どの状態の回も deleted_at、未送信を canceled、展開を止め、status はそのまま、
//   消せる経路の remove を commit の後に呼ぶ(失敗は failedChannels)、削除済みは remove だけを呼び直し監査は書かない、監査 deleted
// - d2 まとめて削除(回ごとの結果、無い id は reason not_found)と削除の見込み(書かない)
// - d3 再送: 本文を残す連絡は failed を queued に戻す(lease 中の行は触らない、unknown は明示の時だけ・二重の可能性を残す)、
//   record meta は回の vars で新しい回として送る(写しが無ければ 409)、秘密・required・削除・予約は 409、監査 resent
// - 判定の印(画面のボタン)と service は同じ operationFlags
// 実行: pnpm test src/features/core/messaging/services/server/admin
import { test } from "node:test";
import assert from "node:assert/strict";

import { z } from "zod";

import { applyMessageOverride, defineMessage, secretVar } from "@/lib/messaging";
import type { AuditRecordInput } from "@/lib/audit";
import { DomainError } from "@/lib/errors";

import type { MessageDispatch } from "../../../entities/model";
import { MESSAGE_EXPAND_DONE } from "../../../entities/schema";
import type { AnyResolvedMessageDefinition } from "../sendMessage/definition";
import type { SendMessageToManyInput } from "../sendMessage/types";
import {
  adminBulkDeleteDispatches,
  adminDeleteDispatch,
  adminDispatchDeleteSummary,
  adminResendFailed,
  operationFlags,
  type AdminOperationsDeps,
} from "./operations";
import type { FailedDeliveryRow } from "./operationsTypes";

const NOW = new Date("2026-11-12T00:00:00Z");
const REF_A = "storage://pub/notification.image/00000000-0000-4000-8000-00000000000a.png";
const REF_B = "storage://pub/notification.image/00000000-0000-4000-8000-00000000000b.png";
const definitionOf = (extra: Record<string, unknown> = {}) =>
  applyMessageOverride(
    defineMessage({
      key: "shop.notice",
      label: "テストの連絡",
      category: "promotion",
      vars: z.object({ item: z.string(), ...(extra.secret ? { token: secretVar(z.string()) } : {}) }),
      ...(extra.required ? { required: true } : {}),
      record: (extra.record as "meta" | "vars" | undefined) ?? "vars",
      content: { email: { subject: "{{item}}" } },
    }),
  ) as unknown as AnyResolvedMessageDefinition;

type Row = { id: string; status: string; userId: string | null; channel: string; lockedUntil: Date | null; nextAttemptAt: Date | null; attempts: number };

const D1 = "00000000-0000-4000-8000-0000000000d1";
const D9 = "00000000-0000-4000-8000-0000000000d9";

function setup(
  dispatchOver: Partial<MessageDispatch> = {},
  options: { definition?: AnyResolvedMessageDefinition | null; role?: string; removeFails?: boolean } = {},
) {
  const dispatch = {
    id: "d1",
    status: "completed_with_failures",
    expand_cursor: MESSAGE_EXPAND_DONE,
    deleted_at: null,
    record: "vars",
    vars: { item: "靴" },
    metadata: { inboxImages: { [REF_A]: REF_B } },
    source: "shop.notice",
    reason: null,
    is_test: false,
    template_id: null,
    template_version: null,
    ...dispatchOver,
  } as unknown as MessageDispatch;
  const rows: Row[] = [
    { id: "r1", status: "failed", userId: "u1", channel: "email", lockedUntil: null, nextAttemptAt: null, attempts: 5 },
    { id: "r2", status: "unknown", userId: "u2", channel: "email", lockedUntil: null, nextAttemptAt: null, attempts: 1 },
    { id: "r3", status: "queued", userId: "u3", channel: "email", lockedUntil: null, nextAttemptAt: NOW, attempts: 0 },
    { id: "r4", status: "sent", userId: "u4", channel: "email", lockedUntil: null, nextAttemptAt: null, attempts: 1 },
    { id: "r5", status: "failed", userId: "u5", channel: "email", lockedUntil: new Date(NOW.getTime() + 60_000), nextAttemptAt: null, attempts: 2 },
  ];
  let inboxItems = 3;
  const audits: AuditRecordInput[] = [];
  const sentNew: { input: SendMessageToManyInput; template?: unknown }[] = [];
  const continued: string[] = [];
  const removeCalls: string[] = [];
  const pick = (include: boolean) => (row: Row) => (row.status === "failed" || (include && row.status === "unknown"));
  const free = (row: Row) => !row.lockedUntil || row.lockedUntil < NOW;
  const deps: AdminOperationsDeps<null> = {
    context: () => ({ actorId: "admin1", actorType: "user" }) as never,
    roleCategoryOf: async () => options.role ?? "admin",
    now: () => NOW,
    definitionOf: async () => (options.definition === undefined ? definitionOf() : options.definition),
    sendResolved: async (_resolved, input, template) => {
      sentNew.push({ input, template });
      return { dispatchId: "d2", status: "processing", deliveries: [], queuedCount: 0, channelCounts: {} };
    },
    continueSending: async (id) => continued.push(id),
    channels: () =>
      [
        { key: "email", label: "メール" },
        {
          key: "inApp",
          label: "お知らせ",
          remove: async ({ dispatchId }: { dispatchId: string }) => {
            removeCalls.push(dispatchId);
            if (options.removeFails) throw new Error("消せません");
            const removed = inboxItems;
            inboxItems = 0;
            return { removed };
          },
        },
      ] as never,
    recordAudit: async (input) => audits.push(input),
    store: {
      withLockedDispatch: async (id, run) => run(null, id === dispatch.id ? dispatch : null),
      updateDispatch: async (_tx, _id, patch) => {
        Object.assign(dispatch, patch);
      },
      cancelUnsent: async () => {
        const queued = rows.filter((row) => row.status === "queued");
        for (const row of queued) Object.assign(row, { status: "canceled", nextAttemptAt: null });
        return queued.length;
      },
      findDispatches: async (ids) =>
        ids.filter((id) => id === dispatch.id).map(() => ({ id: dispatch.id, status: dispatch.status, deleted_at: dispatch.deleted_at })),
      deliveryCounts: async (ids) =>
        ids.includes(dispatch.id)
          ? Object.values(
              rows.reduce<Record<string, { channel: string; status: string; count: number }>>((acc, row) => {
                const key = `${row.channel}:${row.status}`;
                acc[key] = { channel: row.channel, status: row.status, count: (acc[key]?.count ?? 0) + 1 };
                return acc;
              }, {}),
            )
          : [],
      countSharedInbox: async (ids) => (ids.includes(dispatch.id) ? 1 : 0),
      countFailed: async () => ({
        failed: rows.filter((row) => row.status === "failed").length,
        unknown: rows.filter((row) => row.status === "unknown").length,
      }),
      requeueFailed: async (_tx, _id, { includeUnknown, now }) => {
        const target = rows.filter((row) => pick(includeUnknown)(row) && free(row));
        const counts = { failed: target.filter((r) => r.status === "failed").length, unknown: target.filter((r) => r.status === "unknown").length };
        for (const row of target) Object.assign(row, { status: "queued", nextAttemptAt: now, attempts: 0 });
        return counts;
      },
      listFailed: async (_tx, _id, { includeUnknown, excludeIds }) =>
        rows
          .filter((row) => pick(includeUnknown)(row) && free(row) && !excludeIds.includes(row.id))
          .map((row): FailedDeliveryRow => ({ id: row.id, recipientKey: `user:${row.userId}`, userId: row.userId, address: null, channel: row.channel, status: row.status as "failed" })),
    },
  };
  return { deps, dispatch, rows, audits, sentNew, continued, removeCalls, inbox: () => inboxItems };
}

async function rejectsWith(run: Promise<unknown>, status: number, code?: string) {
  await assert.rejects(run, (error: unknown) => {
    assert.ok(error instanceof DomainError);
    assert.equal(error.status, status);
    if (code) assert.equal(error.code, code);
    return true;
  });
}

test("d1 削除: どの状態でも deleted_at、未送信を止め、展開を止め、status はそのまま、消せる経路を消し、監査 deleted", async () => {
  for (const status of ["scheduled", "processing", "completed", "cancelled"]) {
    const world = setup({ status, expand_cursor: status === "scheduled" ? null : "i:4" });
    const result = await adminDeleteDispatch(world.deps, "d1");
    assert.deepEqual(result, {
      dispatchId: "d1",
      alreadyDeleted: false,
      canceledDeliveries: 1,
      removed: [{ channel: "inApp", removed: 3 }],
      failedChannels: [],
    }, status);
    assert.equal(world.dispatch.status, status, "status は変えない");
    assert.deepEqual(world.dispatch.deleted_at, NOW);
    assert.equal(world.dispatch.expand_cursor, MESSAGE_EXPAND_DONE);
    assert.equal(world.rows.find((r) => r.id === "r3")?.status, "canceled");
    assert.equal(world.inbox(), 0);
    assert.deepEqual(world.removeCalls, ["d1"]);
    assert.equal(world.audits.length, 1);
    assert.equal(world.audits[0].action, "messaging.dispatch.deleted");
  }
});

test("d1 削除済みをもう一度: 同じ結果の形で remove だけを呼び直し、監査は書かない。無い回は 404、管理者でなければ 403", async () => {
  const world = setup({ deleted_at: NOW });
  const result = await adminDeleteDispatch(world.deps, "d1");
  assert.equal(result.alreadyDeleted, true);
  assert.equal(result.canceledDeliveries, 0);
  assert.deepEqual(world.removeCalls, ["d1"]);
  assert.equal(world.audits.length, 0);
  assert.equal(world.rows.find((r) => r.id === "r3")?.status, "queued", "削除済みの回の行は触らない");
  await rejectsWith(adminResendFailed(world.deps, "d1"), 409, "deleted");

  await rejectsWith(adminDeleteDispatch(setup().deps, "none"), 404, "not_found");
  await rejectsWith(adminDeleteDispatch(setup({}, { role: "user" }).deps, "d1"), 403);
});

test("d1 削除: remove の失敗は failedChannels に残し、削除そのものは成り立つ", async () => {
  const world = setup({}, { removeFails: true });
  const result = await adminDeleteDispatch(world.deps, "d1");
  assert.deepEqual(result.removed, []);
  assert.deepEqual(result.failedChannels, [{ channel: "inApp", message: "消せません" }]);
  assert.deepEqual(world.dispatch.deleted_at, NOW);
  assert.deepEqual(world.audits[0].metadata, { canceledDeliveries: 1, removed: {}, failedChannels: ["inApp"] });
});

test("d2 まとめて削除: 回ごとの結果(無い回は reason not_found)、入力の誤りは 400", async () => {
  const world = setup({ id: D1 });
  const result = await adminBulkDeleteDispatches(world.deps, { ids: [D1, D9, D1] });
  assert.equal(result.results.length, 2, "同じ id は 1 回");
  assert.equal(result.results[0].dispatchId, D1);
  assert.equal(result.results[0].ok, true);
  assert.deepEqual(result.results[1], { dispatchId: D9, ok: false, reason: "not_found", message: result.results[1].ok ? "" : result.results[1].message });
  assert.deepEqual(world.dispatch.deleted_at, NOW);
  await rejectsWith(adminBulkDeleteDispatches(world.deps, { ids: [] }), 400);
  await rejectsWith(adminBulkDeleteDispatches(world.deps, { ids: ["not-uuid"] }), 400);
});

test("d2 削除の見込み: 見つかった数・予約・未送信・経路ごとの送れた数と消せるか・共有のお知らせ。書かない", async () => {
  const world = setup({ id: D1, status: "scheduled" });
  const summary = await adminDispatchDeleteSummary(world.deps, { ids: [D1, D9] });
  assert.deepEqual(summary, {
    found: 1,
    deleted: 0,
    scheduled: 1,
    unsent: 1,
    channels: [
      { key: "email", label: "メール", removable: false, sent: 1 },
      { key: "inApp", label: "お知らせ", removable: true, sent: 0 },
    ],
    sharedInbox: 1,
  });
  assert.equal(world.dispatch.deleted_at, null);
  assert.deepEqual(world.removeCalls, []);
  assert.equal(world.audits.length, 0);
});

test("d3 再送(本文を残す連絡): failed だけ queued に戻し、lease 中は触らず、1 束送り、監査 resent", async () => {
  const world = setup();
  const result = await adminResendFailed(world.deps, "d1");
  assert.deepEqual(result, { dispatchId: "d1", mode: "requeue", failed: 1, unknown: 0, newDispatchId: null });
  assert.deepEqual(world.rows.map((r) => [r.id, r.status]), [
    ["r1", "queued"],
    ["r2", "unknown"],
    ["r3", "queued"],
    ["r4", "sent"],
    ["r5", "failed"],
  ]);
  assert.equal(world.rows[0].attempts, 0);
  assert.equal(world.dispatch.status, "processing");
  assert.equal(world.dispatch.completed_at, null);
  assert.deepEqual(world.continued, ["d1"]);
  assert.equal("possibleDuplicate" in (world.dispatch.metadata as Record<string, unknown>), false);
  assert.deepEqual(world.audits[0].metadata, { mode: "requeue", failed: 1, unknown: 0, includeUnknown: false, newDispatchId: null });
});

test("d3 再送: unknown は明示の時だけ含め、二重の可能性を回に残す", async () => {
  const world = setup();
  const result = await adminResendFailed(world.deps, "d1", { includeUnknown: true });
  assert.equal(result.unknown, 1);
  assert.equal(world.rows[1].status, "queued");
  const metadata = world.dispatch.metadata as { possibleDuplicate?: boolean; resends: { includeUnknown: boolean }[] };
  assert.equal(metadata.possibleDuplicate, true);
  assert.equal(metadata.resends[0].includeUnknown, true);
  await rejectsWith(adminResendFailed(world.deps, "d1", { includeUnknown: "yes" }), 400);
});

test("d3 再送(record meta): 回の vars で新しい回として送り、同じ宛先を二度送らない。写しが無ければ 409", async () => {
  const world = setup({ record: "meta" }, { definition: definitionOf({ record: "meta" }) });
  const result = await adminResendFailed(world.deps, "d1");
  assert.deepEqual(result, { dispatchId: "d1", mode: "new_dispatch", failed: 1, unknown: 0, newDispatchId: "d2" });
  assert.deepEqual(world.sentNew[0].input.recipients, [{ userId: "u1" }]);
  assert.deepEqual(world.sentNew[0].input.channels, ["email"]);
  assert.deepEqual(world.sentNew[0].input.vars, { item: "靴" });
  assert.deepEqual(world.sentNew[0].input.metadata, { resendOf: "d1" });
  assert.deepEqual(world.continued, []);
  await rejectsWith(adminResendFailed(world.deps, "d1"), 409, "no_failed");

  const noCopy = setup({ record: "meta", vars: null }, { definition: definitionOf({ record: "meta" }) });
  await rejectsWith(adminResendFailed(noCopy.deps, "d1"), 409, "no_input_copy");
});

test("d3 再送できない: 秘密・required・定義なし・予約・失敗なし は 409、管理者でなければ 403", async () => {
  await rejectsWith(adminResendFailed(setup({}, { definition: definitionOf({ secret: true }) }).deps, "d1"), 409, "secret");
  await rejectsWith(adminResendFailed(setup({}, { definition: definitionOf({ required: true }) }).deps, "d1"), 409, "required");
  await rejectsWith(adminResendFailed(setup({}, { definition: null }).deps, "d1"), 409, "definition_missing");
  await rejectsWith(adminResendFailed(setup({ status: "scheduled", expand_cursor: null }).deps, "d1"), 409, "scheduled");
  const empty = setup();
  empty.rows.splice(0, empty.rows.length);
  await rejectsWith(adminResendFailed(empty.deps, "d1"), 409, "no_failed");
  await rejectsWith(adminResendFailed(setup({}, { role: "user" }).deps, "d1"), 403);
});

test("判定の印: 画面のボタンと service は同じ判定", () => {
  const base = { status: "completed", deleted_at: null, record: "vars", vars: {} } as const;
  const policy = { required: false, secret: false, record: "vars" };
  const flags = operationFlags(base, policy, { failed: 2, unknown: 1 });
  assert.deepEqual(flags.canDelete, { allowed: true, reason: null });
  assert.deepEqual(flags.canContinue, { allowed: false, reason: "not_processing" });
  assert.deepEqual(flags.canResend, { allowed: true, reason: null, mode: "requeue", failed: 2, unknown: 1 });
  assert.deepEqual(operationFlags({ ...base, status: "processing" }, policy, { failed: 0, unknown: 0 }).canContinue, { allowed: true, reason: null });
  assert.equal(operationFlags(base, policy, { failed: 0, unknown: 0 }).canResend.reason, "no_failed");
  assert.equal(operationFlags({ ...base, record: "meta", vars: null }, { ...policy, record: "meta" }, { failed: 1, unknown: 0 }).canResend.reason, "no_input_copy");
  const deleted = operationFlags({ ...base, deleted_at: NOW }, policy, { failed: 1, unknown: 0 });
  assert.deepEqual([deleted.canDelete.reason, deleted.canResend.reason, deleted.canContinue.reason], ["deleted", "deleted", "deleted"]);
  assert.equal(operationFlags({ ...base, status: "cancelled" }, policy, { failed: 1, unknown: 0 }).canResend.reason, "cancelled");
  assert.equal(operationFlags({ ...base, status: "scheduled" }, policy, { failed: 1, unknown: 0 }).canResend.reason, "scheduled");
});
