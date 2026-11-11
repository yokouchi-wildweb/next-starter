// 端末の帳簿の service の検査(DB は偽物)
// - 受け付ける経路: 項目があり enabled で、自前の宛先の引き方を持たない経路だけ(上流の email・inApp・line は 400)
// - 本人の同じ宛先は更新して有効に戻す、他人の宛先は付け替えず 409
// - 宛先の形: 経路の宣言(endpoint.address)があればそれで検査して変換後の値を残す、無ければ汎用の形だけ
// - 消すのは本人の行だけ(他人の id は 404)、一覧は本人の行だけ
// - DTO は宛先の末尾 6 文字だけで metadata を返さない
// 実行: pnpm test src/features/core/messaging/services/server/endpoints
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { z } from "zod";

import type { MessageChannel } from "@/lib/messaging";
import { DomainError } from "@/lib/errors";

import type { MessageEndpoint } from "../../../entities/model";
import { createEndpointService } from "./endpointService";
import type { MessageEndpointStore } from "./types";

const NOW = new Date("2026-11-11T00:00:00.000Z");

function channel(key: string, extra: Partial<MessageChannel> = {}): MessageChannel {
  return { key, label: key, addressing: "user", fields: z.object({}), send: async () => [], ...extra };
}

function setup() {
  const rows: MessageEndpoint[] = [];
  const store: MessageEndpointStore = {
    async findByChannelAddress(ch, address) {
      return rows.find((row) => row.channel === ch && row.address === address) ?? null;
    },
    async insert(values) {
      const row = {
        id: randomUUID(),
        kind: null,
        metadata: null,
        is_active: true,
        last_used_at: null,
        createdAt: NOW,
        updatedAt: NOW,
        ...values,
      } as MessageEndpoint;
      rows.push(row);
      return row;
    },
    async update(id, patch) {
      const row = rows.find((item) => item.id === id)!;
      Object.assign(row, patch);
      return row;
    },
    async deleteOwn(userId, id) {
      const index = rows.findIndex((row) => row.id === id && row.user_id === userId);
      if (index < 0) return false;
      rows.splice(index, 1);
      return true;
    },
    async listOwn(userId) {
      return rows.filter((row) => row.user_id === userId);
    },
    async deleteAllOfUser(userId) {
      for (let i = rows.length - 1; i >= 0; i -= 1) if (rows[i].user_id === userId) rows.splice(i, 1);
    },
  };
  const channels = {
    push: channel("push"),
    email: channel("email", { resolveAddresses: async () => [] }),
    sms: channel("sms", { enabled: false }),
    // 宛先の形を宣言した経路(E.164 の電話番号。前後の空白を落とし、ハイフンを外して残す)
    phone: channel("phone", {
      endpoint: { address: z.string().transform((v) => v.replace(/-/g, "")).pipe(z.string().regex(/^\+[1-9]\d{6,14}$/, "E.164 の形")) },
    }),
  };
  return { rows, service: createEndpointService({ store, channels, now: () => NOW }) };
}

const rejects = (promise: Promise<unknown>, status: number) =>
  assert.rejects(promise, (error: unknown) => error instanceof DomainError && error.status === status);

test("帳簿を読む経路だけ受け付ける(自前の引き方を持つ・切の・無い経路は 400)", async () => {
  const { service } = setup();
  await rejects(service.registerEndpoint("u1", { channel: "email", address: "a@x" }), 400);
  await rejects(service.registerEndpoint("u1", { channel: "sms", address: "+8190" }), 400);
  await rejects(service.registerEndpoint("u1", { channel: "ghost", address: "x" }), 400);
  await rejects(service.registerEndpoint("u1", { channel: "push", address: "" }), 400);
  await rejects(service.registerEndpoint("u1", { channel: "push", address: "t", extra: 1 }), 400);
  const dto = await service.registerEndpoint("u1", { channel: "push", address: "token-abcdef123456", kind: "web" });
  assert.equal(dto.channel, "push");
});

test("本人の同じ宛先は更新して有効に戻し、DTO は宛先の末尾 6 文字だけで metadata を返さない", async () => {
  const { service, rows } = setup();
  const first = await service.registerEndpoint("u1", {
    channel: "push",
    address: "token-abcdef123456",
    kind: "web",
    metadata: { browser: "chrome" },
  });
  rows[0].is_active = false;
  const again = await service.registerEndpoint("u1", { channel: "push", address: "token-abcdef123456", kind: "ios" });
  assert.equal(rows.length, 1);
  assert.equal(again.id, first.id);
  assert.equal(rows[0].is_active, true);
  assert.equal(rows[0].kind, "ios");
  assert.deepEqual(rows[0].metadata, { browser: "chrome" });
  assert.deepEqual(Object.keys(again).sort(), ["addressHint", "channel", "createdAt", "id", "isActive", "kind", "lastUsedAt"]);
  assert.equal(again.addressHint, "123456");
});

test("他人の宛先は付け替えず 409、行は変わらない", async () => {
  const { service, rows } = setup();
  await service.registerEndpoint("u1", { channel: "push", address: "shared-token" });
  await rejects(service.registerEndpoint("u2", { channel: "push", address: "shared-token" }), 409);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].user_id, "u1");
});

test("消すのは本人の行だけ(他人の id は 404)、一覧は本人の行だけ", async () => {
  const { service, rows } = setup();
  const mine = await service.registerEndpoint("u1", { channel: "push", address: "t1" });
  await service.registerEndpoint("u2", { channel: "push", address: "t2" });
  await rejects(service.removeEndpoint("u2", mine.id), 404);
  assert.deepEqual((await service.listEndpoints("u1")).map((e) => e.id), [mine.id]);
  await service.removeEndpoint("u1", mine.id);
  assert.deepEqual(rows.map((row) => row.user_id), ["u2"]);
});

test("metadata は平らな値だけ・大きさの上限つき", async () => {
  const { service } = setup();
  await rejects(service.registerEndpoint("u1", { channel: "push", address: "t", metadata: { nested: { a: 1 } } }), 400);
  await rejects(service.registerEndpoint("u1", { channel: "push", address: "t", metadata: Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`k${i}`, "x".repeat(100)])) }), 400);
});

test("宛先の形: 宣言のある経路はその zod で検査して変換後の値を残す、宣言の無い経路は汎用の形だけ", async () => {
  const { service, rows } = setup();
  await rejects(service.registerEndpoint("u1", { channel: "phone", address: "090-1234-5678" }), 400);
  const dto = await service.registerEndpoint("u1", { channel: "phone", address: " +81-90-1234-5678 " });
  assert.equal(rows[0].address, "+819012345678");
  assert.equal(dto.addressHint, "345678");
  // 同じ宛先を別の書き方で登録し直しても、変換後の値で同じ行に当たる
  const again = await service.registerEndpoint("u1", { channel: "phone", address: "+819012345678" });
  assert.equal(again.id, dto.id);
  assert.equal(rows.length, 1);
  await service.registerEndpoint("u1", { channel: "push", address: "any-shape" });
  assert.equal(rows[1].address, "any-shape");
});
