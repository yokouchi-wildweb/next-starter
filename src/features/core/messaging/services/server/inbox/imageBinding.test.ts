// お知らせの画像を回に結ぶ規則(imageBinding.ts)の検査。台帳は偽物
// - 自分(回の actor)が上げた未紐付けの画像はそのまま attach、別の人の・他の行に結ばれた・用途の違う画像は回ごとに 1 回複製して attach
// - 回の metadata.inboxImages の対応があれば使い回す(束・送り直し)、既にこの回に結ばれた画像はそのまま
// - storage:// でない値は結ばない。保持の掃除が外す参照の一覧
// - 展開の共有の行(bindExpansionImage): 行の画像を結んだ参照にし、対応を回の patch の metadata に入れる
// 実行: pnpm test src/features/core/messaging/services/server/inbox
import { test } from "node:test";
import assert from "node:assert/strict";

import { bindExpansionImage } from "../sweep/expandImage";
import {
  INBOX_IMAGES_METADATA_KEY,
  bindInboxImages,
  boundInboxImageRefs,
  inboxImageMapping,
  type InboxImageLedger,
  type InboxImageObject,
} from "./imageBinding";

const ref = (n: number, purpose = "notification.image") => `storage://pub/${purpose}/0190a3b2-0000-7000-8000-${String(n).padStart(12, "0")}.png`;

function fakeLedger(objects: Record<string, InboxImageObject>) {
  const attached: { ref: string; actorUserId: string | null; dispatchId: string; tx: string }[] = [];
  const copied: string[] = [];
  let next = 100;
  const ledger: InboxImageLedger<string> = {
    find: async (value) => objects[value] ?? null,
    attach: async (tx, input) => {
      attached.push({ ...input, tx });
    },
    copy: async (source) => {
      copied.push(source);
      return ref((next += 1));
    },
  };
  return { ledger, attached, copied };
}

const ready = (over: Partial<InboxImageObject> = {}): InboxImageObject => ({
  status: "ready",
  purpose: "notification.image",
  ownerUserId: "admin-1",
  recordType: null,
  recordId: null,
  ...over,
});

const dispatch = { id: "d1", actor_id: "admin-1", metadata: { keep: 1 } as Record<string, unknown> | null };

test("回の actor が上げた未紐付けの画像はそのまま回に attach し、対応を metadata に足す", async () => {
  const { ledger, attached, copied } = fakeLedger({ [ref(1)]: ready() });
  const { map, metadata } = await bindInboxImages(ledger, "tx", dispatch, [ref(1), ref(1)]);
  assert.equal(map.get(ref(1)), ref(1));
  assert.deepEqual(attached, [{ ref: ref(1), actorUserId: "admin-1", dispatchId: "d1", tx: "tx" }]);
  assert.equal(copied.length, 0);
  assert.deepEqual(metadata, { keep: 1, [INBOX_IMAGES_METADATA_KEY]: { [ref(1)]: ref(1) } });
});

test("別の人が上げた・他の行に結ばれた・用途の違う・台帳に無い画像は複製して複製を attach(持ち主なし)", async () => {
  const cases: [string, InboxImageObject | null][] = [
    [ref(1), ready({ ownerUserId: "someone-else" })],
    [ref(2), ready({ recordType: "messaging.dispatch", recordId: "other-dispatch" })],
    [ref(3, "coupon.image_url"), ready({ purpose: "coupon.image_url" })],
    [ref(4), null],
    [ref(5), ready({ status: "pending" })],
  ];
  for (const [value, object] of cases) {
    const { ledger, attached, copied } = fakeLedger(object ? { [value]: object } : {});
    const { map } = await bindInboxImages(ledger, "tx", dispatch, [value]);
    assert.deepEqual(copied, [value], value);
    assert.notEqual(map.get(value), value);
    assert.deepEqual(attached, [{ ref: map.get(value), actorUserId: null, dispatchId: "d1", tx: "tx" }]);
  }
});

test("対応があれば使い回す・既にこの回に結ばれた画像はそのまま(台帳に触らない / metadata は変えない)", async () => {
  const { ledger, attached, copied } = fakeLedger({ [ref(2)]: ready({ recordType: "messaging.dispatch", recordId: "d1" }) });
  const known = { ...dispatch, metadata: { [INBOX_IMAGES_METADATA_KEY]: { [ref(1)]: ref(9) } } };
  const first = await bindInboxImages(ledger, "tx", known, [ref(1)]);
  assert.equal(first.map.get(ref(1)), ref(9));
  assert.equal(first.metadata, null);
  const second = await bindInboxImages(ledger, "tx", known, [ref(2)]);
  assert.equal(second.map.get(ref(2)), ref(2));
  assert.deepEqual(attached, []);
  assert.deepEqual(copied, []);
});

test("storage:// でない値(固定の URL)は結ばない", async () => {
  const { ledger, attached, copied } = fakeLedger({});
  const { map, metadata } = await bindInboxImages(ledger, "tx", dispatch, ["https://example.test/a.png", null, ""]);
  assert.equal(map.get("https://example.test/a.png"), "https://example.test/a.png");
  assert.equal(metadata, null);
  assert.deepEqual([attached.length, copied.length], [0, 0]);
});

test("system の回(actor null)は持ち主なしの画像だけをそのまま attach する", async () => {
  const { ledger, attached, copied } = fakeLedger({ [ref(1)]: ready({ ownerUserId: null }), [ref(2)]: ready() });
  await bindInboxImages(ledger, "tx", { ...dispatch, actor_id: null }, [ref(1), ref(2)]);
  assert.deepEqual(attached.map((row) => row.ref).slice(0, 1), [ref(1)]);
  assert.deepEqual(copied, [ref(2)]);
});

test("保持の掃除が外す参照: 対応の値のうち storage:// だけ(重なりは 1 つ)", () => {
  const metadata = { [INBOX_IMAGES_METADATA_KEY]: { [ref(1)]: ref(2), [ref(3)]: ref(2), url: "https://example.test/a.png", bad: 1 } };
  assert.deepEqual(boundInboxImageRefs(metadata), [ref(2)]);
  assert.deepEqual(inboxImageMapping({ [INBOX_IMAGES_METADATA_KEY]: [] }), {});
  assert.deepEqual(boundInboxImageRefs(null), []);
});

test("展開の共有の行: 画像を結んだ参照にし、対応を回の patch の metadata に入れる(patch の metadata があれば足す)", async () => {
  const { ledger } = fakeLedger({ [ref(1)]: ready({ ownerUserId: "x" }) });
  const item = { dispatch_id: "d1", user_id: null, target_roles: null, title: "題", body: "本文", link: null, image: ref(1), published_at: new Date(0) };
  const out = await bindExpansionImage(ledger, "tx", dispatch, { rows: [], patch: { expand_cursor: "~done", metadata: { p: 1 } }, inboxItem: item });
  assert.notEqual(out.inboxItem?.image, ref(1));
  assert.deepEqual(out.patch.metadata, { p: 1, [INBOX_IMAGES_METADATA_KEY]: { [ref(1)]: out.inboxItem?.image } });
  assert.equal(out.patch.expand_cursor, "~done");
  const plain = { rows: [], patch: {}, inboxItem: { ...item, image: null } };
  assert.equal(await bindExpansionImage(ledger, "tx", dispatch, plain), plain);
});
