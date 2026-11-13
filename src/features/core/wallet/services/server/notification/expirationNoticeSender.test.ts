// 失効の知らせの送り手(sendExpirationNoticeJobs)の検査。DB・送る口・設定は偽物
// - 送信済みの鍵(回の表と鍵の移し先の表、messagingService.existingIdempotencyKeys)は送らずに alreadySent
// - 宛先の絞り込み(削除済み・demo・状態・メールの無い人からメールを外す)
// - 送る口へ定義・経路・鍵・送り元と、宛名(名前が無ければ「お客様」)・サービスの短い名前を足した vars を渡す
// - sent か queued(送り直し待ち)があれば sent、409 は alreadySent、他は failed
// 実行: pnpm test src/features/core/wallet/services/server/notification/expirationNoticeSender.test.ts
import { before, mock, test } from "node:test";
import assert from "node:assert/strict";

type Call = { message: { key: string }; input: Record<string, unknown> };
const calls: Call[] = [];
let users: Record<string, unknown>[] = [];
let existing = new Set<string>();
let outcome: (key: string) => unknown = () => ({ deliveries: [{ status: "sent" }] });

mock.module("@/lib/drizzle", {
  namedExports: { db: { select: () => ({ from: () => ({ where: async () => users }) }) } },
});
mock.module("@/features/core/user/entities/drizzle", { namedExports: { UserTable: {} } });
mock.module("@/business", { namedExports: { business: { serviceNameShort: "short" } } });
// config の messageKey が指す fork の連絡(生成の一覧)
const forkMessage = { key: "shop.pointExpiring" };
mock.module("@/registry/messageRegistry", {
  namedExports: { messageRegistry: { "shop.pointExpiring": { key: "shop.pointExpiring", definition: async () => ({ message: forkMessage }) } } },
});
mock.module("@/features/core/messaging/services/server/messagingService", {
  namedExports: {
    messagingService: {
      existingIdempotencyKeys: async () => existing,
      sendMessage: async (message: { key: string }, input: Record<string, unknown>) => {
        calls.push({ message, input });
        const result = outcome(input.idempotencyKey as string);
        if (result instanceof Error) throw result;
        return result;
      },
    },
  },
});
mock.module("@/features/wallet/config", {
  namedExports: { walletConfig: { expirationNoticeSettings: { targetStatuses: ["active"], sendConcurrency: 2 } } },
});

let sender: typeof import("./expirationNoticeSender");
let DomainError: typeof import("@/lib/errors").DomainError;

before(async () => {
  sender = await import("./expirationNoticeSender");
  ({ DomainError } = await import("@/lib/errors"));
});

const message = { key: "wallet.expiringNotice" } as never;
const job = (userId: string) => ({
  userId,
  idempotencyKey: `k-${userId}`,
  message,
  vars: { currencyLabel: "コイン" },
  source: "wallet.expiration.preNotice" as never,
});
const user = (id: string, over: Record<string, unknown> = {}) => ({ id, status: "active", name: `名${id}`, email: `${id}@x`, isDemo: false, deletedAt: null, ...over });
const future = () => new Date(Date.now() + 60_000);

test("送信済みを除き、絞り込んでから送る口へ渡す", async () => {
  calls.length = 0;
  existing = new Set(["k-u0"]);
  users = [user("u1"), user("u2", { name: null, email: null }), user("u3", { isDemo: true }), user("u4", { status: "banned" }), user("u5", { deletedAt: new Date() })];
  const counts = sender.createExpirationNoticeCounts();
  await sender.sendExpirationNoticeJobs(
    [job("u0"), job("u1"), job("u2"), job("u3"), job("u4"), job("u5"), job("u6"), job("u2b")],
    counts,
    { consecutiveFailures: 0 },
    future(),
  );
  assert.deepEqual(calls.map((c) => c.input.recipient), [{ userId: "u1" }, { userId: "u2" }]);
  assert.deepEqual(calls[0].input, {
    recipient: { userId: "u1" },
    vars: { currencyLabel: "コイン", displayName: "名u1", serviceNameShort: "short" },
    source: "wallet.expiration.preNotice",
    idempotencyKey: "k-u1",
  });
  // 経路は渡さない(種類が決める。メールの無い人のメールの行は送る口が no_address にする)、名前が無ければ「お客様」
  assert.equal("channels" in calls[1].input, false);
  assert.equal((calls[1].input.vars as Record<string, string>).displayName, "お客様");
  assert.equal(calls[0].message, message);
  assert.deepEqual(counts, { sent: 2, alreadySent: 1, skippedStatus: 1, skippedDemo: 1, skippedUserMissing: 3, failed: 0 });
});

test("queued は sent、409 は alreadySent、送れなかった・投げたら failed", async () => {
  calls.length = 0;
  existing = new Set();
  users = ["a", "b", "c", "d"].map((id) => user(id));
  outcome = (key) =>
    key === "k-a"
      ? { deliveries: [{ status: "failed" }, { status: "queued" }] }
      : key === "k-b"
        ? new DomainError("dup", { status: 409 })
        : key === "k-c"
          ? { deliveries: [{ status: "failed" }, { status: "suppressed" }] }
          : new Error("boom");
  const counts = sender.createExpirationNoticeCounts();
  const state = { consecutiveFailures: 0 };
  await sender.sendExpirationNoticeJobs([job("a"), job("b"), job("c"), job("d")], counts, state, future());
  assert.deepEqual([counts.sent, counts.alreadySent, counts.failed], [1, 1, 2]);
  assert.equal(state.consecutiveFailures, 2);
});

test("段の messageKey: 省略・上流の鍵は上流の連絡、fork の鍵は生成の一覧から、知らない鍵は止める", async () => {
  const upstream = { key: "wallet.expiringNotice" } as never;
  assert.equal(await sender.noticeMessageOf(undefined, upstream), upstream);
  assert.equal(await sender.noticeMessageOf("wallet.expiringNotice", upstream), upstream);
  assert.equal(await sender.noticeMessageOf("shop.pointExpiring", upstream), forkMessage);
  await assert.rejects(sender.noticeMessageOf("shop.nope", upstream), /messageKey shop\.nope は連絡の一覧/);
});
