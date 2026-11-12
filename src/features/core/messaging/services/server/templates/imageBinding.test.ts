// テンプレートの画像の結び付け(bindTemplateImages)の検査(台帳は偽物)
// - 既にこのテンプレートに結ばれている = そのまま / ready・未紐付け・用途 notification.image・自分が上げた = attach
// - 他の業務行に結ばれている・別の人が上げた・用途が違う = 複製して attach し参照を書き換える / storage:// でない値はそのまま
// 実行: pnpm test src/features/core/messaging/services/server/templates
import { test } from "node:test";
import assert from "node:assert/strict";

import { formatStorageRef } from "@/lib/storage";

import type { InboxImageObject } from "../inbox/imageBinding";
import { bindTemplateImages, TEMPLATE_IMAGE_RECORD_TYPE } from "./imageBinding";

const ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TEMPLATE = "11111111-1111-4111-8111-111111111111";
const LEDGER: Record<string, string> = {
  own: "00000000-0000-4000-8000-000000000001",
  bound: "00000000-0000-4000-8000-000000000002",
  other: "00000000-0000-4000-8000-000000000003",
  someone: "00000000-0000-4000-8000-000000000004",
};
const ref = (name: string) => formatStorageRef({ store: "pub", purposeId: "notification.image", ledgerId: LEDGER[name], ext: "png" });

test("結び方: そのまま・attach・複製、参照の書き換え", async () => {
  const objects: Record<string, InboxImageObject> = {
    [ref("own")]: { status: "ready", purpose: "notification.image", ownerUserId: ADMIN, recordType: null, recordId: null },
    [ref("bound")]: { status: "ready", purpose: "notification.image", ownerUserId: ADMIN, recordType: TEMPLATE_IMAGE_RECORD_TYPE, recordId: TEMPLATE },
    [ref("other")]: { status: "ready", purpose: "notification.image", ownerUserId: ADMIN, recordType: "messaging.dispatch", recordId: "d1" },
    [ref("someone")]: { status: "ready", purpose: "notification.image", ownerUserId: "someone-else", recordType: null, recordId: null },
  };
  const attached: string[] = [];
  const copied: string[] = [];
  const ledger = {
    find: async (r: string) => objects[r] ?? null,
    attach: async (_tx: null, input: { ref: string; templateId: string }) => {
      assert.equal(input.templateId, TEMPLATE);
      attached.push(input.ref);
    },
    copy: async (r: string) => {
      copied.push(r);
      return `${r}-copy`;
    },
  };
  const content = {
    inApp: { title: "t", body: "b", image: ref("own") },
    email: { subject: "s", paragraphs: [ref("bound"), ref("other"), ref("someone"), "https://example.test/x.png"] },
  };
  const result = await bindTemplateImages(ledger, null, { templateId: TEMPLATE, actorUserId: ADMIN, content });
  assert.deepEqual(attached, [ref("own"), `${ref("other")}-copy`, `${ref("someone")}-copy`]);
  assert.deepEqual(copied, [ref("other"), ref("someone")]);
  assert.deepEqual(result, {
    inApp: { title: "t", body: "b", image: ref("own") },
    email: { subject: "s", paragraphs: [ref("bound"), `${ref("other")}-copy`, `${ref("someone")}-copy`, "https://example.test/x.png"] },
  });
  // storage:// が無ければ同じ物を返す
  const plain = { inApp: { title: "t", body: "b" } };
  assert.equal(await bindTemplateImages(ledger, null, { templateId: TEMPLATE, actorUserId: ADMIN, content: plain }), plain);
});
