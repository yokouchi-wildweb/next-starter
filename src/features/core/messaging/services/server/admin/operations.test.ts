// 管理の回の操作の検査(DB・定義・送る口・監査は偽物。store の規則は operationsStore.ts と同じ)
// - d1 取り消し: 予約で展開の前だけ cancelled、他は 409、監査 cancelled
// - d2 取り下げ: お知らせの行を消し、未送信を canceled、展開を止め retracted_at、status はそのまま、画像を外す、2 回目・予約は 409
// - d3 再送: 本文を残す連絡は failed を queued に戻す(lease 中の行は触らない、unknown は明示の時だけ・二重の可能性を残す)、
//   record meta は回の vars で新しい回として送る(写しが無ければ 409)、秘密・required・取り下げ・予約は 409、監査 resent
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
  adminCancelScheduled,
  adminResendFailed,
  adminRetract,
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
      kind: "marketing",
      category: "marketing",
      vars: z.object({ item: z.string(), ...(extra.secret ? { token: secretVar(z.string()) } : {}) }),
      ...(extra.required ? { required: true } : {}),
      record: (extra.record as "meta" | "vars" | undefined) ?? "vars",
      defaultChannels: ["email"],
      content: { email: { subject: "{{item}}" } },
    }),
  ) as unknown as AnyResolvedMessageDefinition;

type Row = { id: string; status: string; userId: string | null; channel: string; lockedUntil: Date | null; nextAttemptAt: Date | null; attempts: number };

function setup(dispatchOver: Partial<MessageDispatch> = {}, options: { definition?: AnyResolvedMessageDefinition | null; role?: string } = {}) {
  const dispatch = {
    id: "d1",
    status: "completed_with_failures",
    expand_cursor: MESSAGE_EXPAND_DONE,
    retracted_at: null,
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
  const detached: string[][] = [];
  const cleaned: string[][] = [];
  const audits: AuditRecordInput[] = [];
  const sentNew: { input: SendMessageToManyInput; template?: unknown }[] = [];
  const continued: string[] = [];
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
    recordAudit: async (input) => audits.push(input),
    store: {
      withLockedDispatch: async (id, run) => run(null, id === dispatch.id ? dispatch : null),
      updateDispatch: async (_tx, _id, patch) => {
        Object.assign(dispatch, patch);
      },
      deleteInboxItems: async () => {
        const n = inboxItems;
        inboxItems = 0;
        return n;
      },
      cancelUnsent: async () => {
        const queued = rows.filter((row) => row.status === "queued");
        for (const row of queued) Object.assign(row, { status: "canceled", nextAttemptAt: null });
        return queued.length;
      },
      detachImages: async (_tx, _id, refs) => {
        detached.push([...refs]);
        return refs.map((ref) => `ledger-${ref}`);
      },
      cleanupImages: async (ids) => {
        cleaned.push([...ids]);
      },
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
  return { deps, dispatch, rows, audits, detached, cleaned, sentNew, continued, inbox: () => inboxItems };
}

async function rejectsWith(run: Promise<unknown>, status: number, code?: string) {
  await assert.rejects(run, (error: unknown) => {
    assert.ok(error instanceof DomainError);
    assert.equal(error.status, status);
    if (code) assert.equal(error.code, code);
    return true;
  });
}

test("d1 取り消し: 予約で展開の前だけ cancelled、他は 409", async () => {
  const scheduled = setup({ status: "scheduled", expand_cursor: null, scheduled_at: NOW });
  assert.deepEqual(await adminCancelScheduled(scheduled.deps, "d1"), { dispatchId: "d1", status: "cancelled" });
  assert.equal(scheduled.dispatch.status, "cancelled");
  assert.equal(scheduled.audits[0].action, "messaging.dispatch.cancelled");
  await rejectsWith(adminCancelScheduled(scheduled.deps, "d1"), 409, "not_scheduled");

  await rejectsWith(adminCancelScheduled(setup({ status: "scheduled", expand_cursor: "i:2" }).deps, "d1"), 409, "already_started");
  await rejectsWith(adminCancelScheduled(setup().deps, "d1"), 409, "not_scheduled");
  await rejectsWith(adminCancelScheduled(setup().deps, "none"), 404, "not_found");
});

test("d2 取り下げ: お知らせの行と未送信を止め、展開を止め、status はそのまま、画像を外し、2 回目は 409", async () => {
  const world = setup({ status: "processing", expand_cursor: "i:4" });
  const result = await adminRetract(world.deps, "d1");
  assert.deepEqual(result, { dispatchId: "d1", deletedInboxItems: 3, canceledDeliveries: 1, detachedImages: 1 });
  assert.equal(world.inbox(), 0);
  assert.equal(world.rows.find((r) => r.id === "r3")?.status, "canceled");
  assert.equal(world.dispatch.status, "processing");
  assert.equal(world.dispatch.expand_cursor, MESSAGE_EXPAND_DONE);
  assert.deepEqual(world.dispatch.retracted_at, NOW);
  assert.deepEqual(world.detached, [[REF_B]]);
  assert.deepEqual(world.cleaned, [[`ledger-${REF_B}`]]);
  assert.equal("inboxImages" in (world.dispatch.metadata as Record<string, unknown>), false);
  assert.equal(world.audits[0].action, "messaging.dispatch.retracted");
  await rejectsWith(adminRetract(world.deps, "d1"), 409, "retracted");
  await rejectsWith(adminResendFailed(world.deps, "d1"), 409, "retracted");

  await rejectsWith(adminRetract(setup({ status: "scheduled", expand_cursor: null }).deps, "d1"), 409, "scheduled_use_cancel");
  await rejectsWith(adminRetract(setup({ status: "cancelled" }).deps, "d1"), 409, "cancelled");
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
  await rejectsWith(adminRetract(setup({}, { role: "user" }).deps, "d1"), 403);
});

test("判定の印: 画面のボタンと service は同じ判定", () => {
  const base = { status: "completed", expand_cursor: MESSAGE_EXPAND_DONE, retracted_at: null, record: "vars", vars: {} } as const;
  const policy = { required: false, secret: false, record: "vars" };
  const flags = operationFlags(base, policy, { failed: 2, unknown: 1 });
  assert.deepEqual(flags.cancel, { allowed: false, reason: "not_scheduled" });
  assert.deepEqual(flags.retract, { allowed: true, reason: null });
  assert.deepEqual(flags.resend, { allowed: true, reason: null, mode: "requeue", failed: 2, unknown: 1 });
  assert.equal(operationFlags(base, policy, { failed: 0, unknown: 0 }).resend.reason, "no_failed");
  assert.equal(operationFlags({ ...base, record: "meta", vars: null }, { ...policy, record: "meta" }, { failed: 1, unknown: 0 }).resend.reason, "no_input_copy");
  assert.equal(operationFlags({ ...base, retracted_at: NOW }, policy, { failed: 1, unknown: 0 }).resend.reason, "retracted");
});
