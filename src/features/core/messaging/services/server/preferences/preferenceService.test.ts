// 好みの service の検査(DB は偽物)
// - 表 = 種類の受け口 × 有効な経路(enabled: false の経路は出ない)。マスの止まり方は送る側の checkStops と同じ
// - 宛先の有無: 経路の自前の引き方 / 無ければ端末の帳簿。connectHref は門で閉じた住所なら null
// - 1 マス・全体('*' '*')を止める(source user)/ 再開する(そのマスの行だけ消す。広い行は via で残る)
// - 知らない種類・有効でない経路・片方だけの '*' は 400
// 実行: pnpm test src/features/core/messaging/services/server/preferences
import { test } from "node:test";
import assert from "node:assert/strict";

import { z } from "zod";

import type { MessageCategory, MessageChannel } from "@/lib/messaging";
import { DomainError } from "@/lib/errors";

import { checkStops } from "../sendMessage/stops";
import type { MessageSendDeps } from "../sendMessage/types";
import { createPreferenceService, preferenceVia } from "./preferenceService";
import type { MessagePreferenceRow } from "./types";

const USER = "11111111-1111-4111-8111-111111111111";

function channel(key: string, extra: Partial<MessageChannel> = {}): MessageChannel {
  return { key, label: key.toUpperCase(), addressing: "user", fields: z.object({}), send: async () => [], ...extra };
}

const categories: Record<string, MessageCategory> = {
  marketing: { key: "marketing", label: "キャンペーン情報", kind: "marketing", channels: ["email", "inApp", "push", "sms", "line"] },
  activity: { key: "activity", label: "アクティビティ", description: "反応の通知", kind: "activity", channels: ["email", "inApp"] },
  // 利用者が止められない種別の種類は好みの表に出ない
  registrationComplete: { key: "registrationComplete", label: "会員登録の完了", kind: "transactional", channels: ["email"] },
};

function setup(options: { rows?: MessagePreferenceRow[]; email?: boolean; openHrefs?: string[] } = {}) {
  const rows: (MessagePreferenceRow & { source?: string })[] = [...(options.rows ?? [])];
  const channels: Record<string, MessageChannel> = {
    email: channel("email", {
      resolveAddresses: async (ids) => (options.email === false ? [] : ids.map((userId) => ({ userId, address: "a@x.test" }))),
    }),
    inApp: channel("inApp", { resolveAddresses: async (ids) => ids.map((userId) => ({ userId, address: userId })) }),
    line: channel("line", { enabled: false, connectHref: "/api/auth/line/login" }),
    push: channel("push", { connectHref: "/mypage/push?x=1" }),
    sms: channel("sms", { connectHref: "/mypage/sms" }),
  };
  const service = createPreferenceService({
    store: {
      listOwn: async (userId) => (userId === USER ? rows.map(({ category, channel: ch }) => ({ category, channel: ch })) : []),
      add: async ({ category, channel: ch, source }) => {
        if (!rows.some((row) => row.category === category && row.channel === ch)) rows.push({ category, channel: ch, source });
      },
      remove: async (_userId, category, ch) => {
        const index = rows.findIndex((row) => row.category === category && row.channel === ch);
        if (index >= 0) rows.splice(index, 1);
      },
      deleteAllOfUser: async () => {},
    },
    categories,
    channels,
    findLedgerEndpoints: async (ch, ids) => (ch === "push" ? ids.map((userId) => ({ userId, address: "tok" })) : []),
    isHrefOpen: (href) => (options.openHrefs ?? []).includes(href),
  });
  return { service, rows, channels };
}

test("表: 種類 × 有効な経路、宛先の有無と connectHref(門で閉じた住所は null)", async () => {
  const { service } = setup({ email: false, openHrefs: ["/mypage/push?x=1"] });
  const dto = await service.getPreferences(USER);
  assert.equal(dto.allOptedOut, false);
  assert.deepEqual(dto.channels, [
    { key: "email", label: "EMAIL", hasAddress: false, connectHref: null },
    { key: "inApp", label: "INAPP", hasAddress: true, connectHref: null },
    { key: "push", label: "PUSH", hasAddress: true, connectHref: "/mypage/push?x=1" },
    { key: "sms", label: "SMS", hasAddress: false, connectHref: null },
  ]);
  assert.deepEqual(dto.categories.map((c) => [c.key, c.label, c.description, c.kind]), [
    ["marketing", "キャンペーン情報", null, "marketing"],
    ["activity", "アクティビティ", "反応の通知", "activity"],
  ]);
  assert.ok(dto.categories.every((c) => c.cells.every((cell) => !cell.optedOut && cell.via === null)));
  assert.deepEqual(dto.categories[0].cells.map((cell) => cell.channel), ["email", "inApp", "push", "sms"]);
  // マス = 開いている経路 ∩ 種類の経路(activity は email・inApp だけ)
  assert.deepEqual(dto.categories[1].cells.map((cell) => cell.channel), ["email", "inApp"]);
});

test("1 マスを止めて再開する(source user)、全体の行は allOptedOut と via all", async () => {
  const { service, rows } = setup();
  let dto = await service.setPreference(USER, { category: "marketing", channel: "email", optedOut: true });
  assert.deepEqual(rows, [{ category: "marketing", channel: "email", source: "user" }]);
  assert.deepEqual(dto.categories[0].cells[0], { channel: "email", optedOut: true, via: "cell" });
  assert.equal(dto.categories[1].cells[0].optedOut, false);
  dto = await service.setPreference(USER, { category: "marketing", channel: "email", optedOut: false });
  assert.equal(rows.length, 0);
  assert.equal(dto.categories[0].cells[0].optedOut, false);

  dto = await service.setPreference(USER, { category: "*", channel: "*", optedOut: true });
  assert.equal(dto.allOptedOut, true);
  assert.ok(dto.categories.every((c) => c.cells.every((cell) => cell.optedOut && cell.via === "all")));
  dto = await service.setPreference(USER, { category: "*", channel: "*", optedOut: false });
  assert.equal(dto.allOptedOut, false);
});

test("マスの再開はそのマスの行だけを消す。広い行で止まるマスは via で残る", async () => {
  const { service, rows } = setup({ rows: [{ category: "activity", channel: "*" }, { category: "activity", channel: "email" }] });
  const dto = await service.setPreference(USER, { category: "activity", channel: "email", optedOut: false });
  assert.deepEqual(rows, [{ category: "activity", channel: "*" }]);
  assert.deepEqual(dto.categories[1].cells[0], { channel: "email", optedOut: true, via: "category" });
});

test("入力の誤り・知らない種類・有効でない経路は 400", async () => {
  const { service } = setup();
  for (const input of [
    null,
    { category: "marketing", channel: "email" },
    { category: "*", channel: "email", optedOut: true },
    { category: "nope", channel: "email", optedOut: true },
    { category: "marketing", channel: "line", optedOut: true },
    { category: "marketing", channel: "email", optedOut: true, userId: "other" },
  ]) {
    await assert.rejects(service.setPreference(USER, input), (error: unknown) => {
      assert.ok(error instanceof DomainError);
      assert.equal(error.status, 400);
      return true;
    });
  }
});

test("マスの止まり方は送る側(checkStops)の判定と同じ", async () => {
  const rowSets: MessagePreferenceRow[][] = [
    [],
    [{ category: "marketing", channel: "email" }],
    [{ category: "marketing", channel: "*" }],
    [{ category: "*", channel: "inApp" }],
    [{ category: "*", channel: "*" }],
    [{ category: "activity", channel: "email" }, { category: "*", channel: "push" }],
  ];
  for (const rows of rowSets) {
    // 送る側の store.findOptOuts と同じ絞り込み(種類 = その種類か '*'、経路 = 送る経路か '*')
    const deps = {
      store: {
        findOptOuts: async (userIds: readonly string[], category: string, chs: readonly string[]) =>
          rows
            .filter((row) => (row.category === category || row.category === "*") && [...chs, "*"].includes(row.channel))
            .flatMap((row) => userIds.map((userId) => ({ userId, channel: row.channel }))),
        findSuppressions: async () => [],
      },
    } as unknown as MessageSendDeps;
    for (const category of ["marketing", "activity"]) {
      for (const ch of ["email", "inApp", "push"]) {
        const [verdict] = await checkStops(deps, { kind: "marketing", required: false, category }, [
          { recipientKey: `user:${USER}`, userId: USER, channel: ch, addresses: ["x"] },
        ]);
        assert.equal(preferenceVia(rows, category, ch) !== null, verdict.stopped, JSON.stringify({ rows, category, ch }));
      }
    }
  }
});

test("API の住所の定数は門 messagingPreferences の pathPatterns にある(ページの住所はページと一緒に足す)", async () => {
  const { rule } = await import("@/featureGate/rules/messagingPreferences");
  const { MESSAGE_PREFERENCES_API_PATH } = await import("../../../constants/preferences");
  assert.ok(rule.pathPatterns?.includes(MESSAGE_PREFERENCES_API_PATH));
  assert.equal(rule.defaultEnabled, false);
});
