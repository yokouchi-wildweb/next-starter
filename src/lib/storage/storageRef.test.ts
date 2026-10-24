// src/lib/storage/storageRef.test.ts
// lib/storage 新基盤の単体テスト（ref / resolveStorageSrc / 配信規則 / スキーマ / fake ポート / 未設定時の挙動）
// 実行: pnpm test:storage-ref

import { afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";

import { isOptimizableSrc } from "@/components/Media/AppImage/optimizable";
import { resolveAppImageSource } from "@/components/Media/AppImage/source";
import { FirebaseNotConfiguredError } from "@/lib/firebase/errors";
import { withMediaRetryQuery } from "./client/usePrivateMediaRecovery";

import {
  contentDispositionFor,
  extensionForContentType,
  matchesContentType,
  normalizeContentType,
} from "./contentTypes";
import {
  formatStorageRef,
  isPrivateObjectPath,
  isPublicStorageUrl,
  isValidStoragePurposeId,
  objectKeyOf,
  parseStorageRef,
  publicStorageBaseUrl,
  publicStorageHosts,
  resolveStorageSrc,
  toStorageDisplaySrc,
} from "./ref";
import { storageMediaValueSchema } from "./schema";
import type { StoragePurposeMap } from "./policy/types";
import { __setStoragePortForTest, createFakeStoragePort, FakeStorageError } from "./server/fake";
import { isLegacyLocation, parseLegacyStorageUrl } from "./server/legacy";
import { getStoragePort, ISSUED_CACHE_CONTROL } from "./server/port";
import {
  listStoragePurposeProblems,
  resolveStoragePurpose,
  StoragePurposeNotFoundError,
} from "./server/purposes";
import {
  getStoreConfig,
  isStorageStoreConfigured,
  locationOf,
  StorageNotConfiguredError,
} from "./server/stores";

const LEDGER_ID = "01920000-0000-7000-8000-000000000001";
const PUB_REF = `storage://pub/user.avatar/${LEDGER_ID}.webp`;
const PRIV_REF = `storage://priv/purchaseRequest.bankProof/${LEDGER_ID}.png`;

const ENV_KEYS = [
  "STORAGE_PUBLIC_BUCKET",
  "STORAGE_PUBLIC_PREFIX",
  "STORAGE_PRIVATE_BUCKET",
  "STORAGE_PRIVATE_PREFIX",
  "NEXT_PUBLIC_STORAGE_PUBLIC_BASE_URL",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "MY_SERVICE_ACCOUNT_KEY",
] as const;

const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  __setStoragePortForTest(null);
});

describe("ref", () => {
  test("組み立てと解析が往復する", () => {
    const parts = { store: "pub", purposeId: "user.avatar", ledgerId: LEDGER_ID, ext: "webp" } as const;
    const ref = formatStorageRef(parts);
    assert.equal(ref, PUB_REF);
    assert.deepEqual(parseStorageRef(ref), parts);
    assert.equal(objectKeyOf(ref), `user.avatar/${LEDGER_ID}.webp`);
  });

  test("用途 ID の形式（field 部は英字始まりの英数字と _）", () => {
    for (const id of ["user.avatar", "purchaseRequest.bankProof", "coupon.image_url", "chatRoom.video"]) {
      assert.equal(isValidStoragePurposeId(id), true, id);
    }
    for (const id of ["user", "1user.avatar", "user._avatar", "user.avatar.x", "user-x.avatar", ".avatar"]) {
      assert.equal(isValidStoragePurposeId(id), false, id);
    }
  });

  test("形式に合わない ref は null、組み立ては throw", () => {
    for (const value of [
      `storage://legacy/user.avatar/${LEDGER_ID}.webp`,
      `storage://main/user.avatar/${LEDGER_ID}.webp`,
      `storage://pub/user/${LEDGER_ID}.webp`,
      `storage://pub/user.avatar/not-a-uuid.webp`,
      `storage://pub/user.avatar/${LEDGER_ID}`,
      `storage://pub/user.avatar/x/${LEDGER_ID}.webp`,
      `storage://pub/user.avatar/${LEDGER_ID}.WEBP`,
      "https://example.com/a.png",
      "",
    ]) {
      assert.equal(parseStorageRef(value), null, value);
    }
    assert.throws(() =>
      formatStorageRef({ store: "pub", purposeId: "bad", ledgerId: LEDGER_ID, ext: "png" }),
    );
  });
});

describe("resolveStorageSrc", () => {
  const base = { publicBaseUrl: "https://storage.example.test/pub-bucket/" };

  test("pub → 公開 base + オブジェクトキー", () => {
    assert.equal(
      resolveStorageSrc(PUB_REF, base),
      `https://storage.example.test/pub-bucket/user.avatar/${LEDGER_ID}.webp`,
    );
  });

  test("pub で base が未設定なら null（env からも読む）", () => {
    assert.equal(resolveStorageSrc(PUB_REF), null);
    process.env.NEXT_PUBLIC_STORAGE_PUBLIC_BASE_URL = "https://cdn.example.test";
    assert.equal(resolveStorageSrc(PUB_REF), `https://cdn.example.test/user.avatar/${LEDGER_ID}.webp`);
  });

  test("priv → 都度認可するルートの固定 URL", () => {
    assert.equal(resolveStorageSrc(PRIV_REF, base), `/api/storage/objects/${LEDGER_ID}`);
  });

  test("http(s) と / 始まりは素通し", () => {
    const legacy = "https://firebasestorage.googleapis.com/v0/b/old/o/a.png?alt=media&token=t";
    assert.equal(resolveStorageSrc(legacy, base), legacy);
    assert.equal(resolveStorageSrc("http://example.com/a.png", base), "http://example.com/a.png");
    assert.equal(resolveStorageSrc("/images/default.png", base), "/images/default.png");
  });

  test("空・不明な store・その他の値は null", () => {
    for (const value of [
      null,
      undefined,
      "",
      "   ",
      `storage://legacy/user.avatar/${LEDGER_ID}.webp`,
      "storage://pub/broken",
      "javascript:alert(1)",
      "data:image/png;base64,AAAA",
      "relative/path.png",
    ]) {
      assert.equal(resolveStorageSrc(value, base), null, String(value));
    }
  });

  test("publicStorageHosts は base のホストだけ", () => {
    assert.deepEqual(publicStorageHosts(base), ["storage.example.test"]);
    assert.deepEqual(publicStorageHosts({ publicBaseUrl: null }), []);
    assert.deepEqual(publicStorageHosts({ publicBaseUrl: "not a url" }), []);
  });
});

describe("toStorageDisplaySrc（表示部品が src に渡す前）", () => {
  const base = { publicBaseUrl: "https://storage.example.test/pub-bucket/" };

  test("ref は resolveStorageSrc と同じ表示用 URL（解析できなければ null）", () => {
    assert.equal(toStorageDisplaySrc(PUB_REF, base), resolveStorageSrc(PUB_REF, base));
    assert.equal(toStorageDisplaySrc(PRIV_REF, base), `/api/storage/objects/${LEDGER_ID}`);
    assert.equal(toStorageDisplaySrc("storage://pub/broken", base), null);
  });

  test("ref 以外は値のまま（プレビュー・解決済みの URL を二重に変換しない）", () => {
    for (const value of [
      "https://storage.example.test/pub-bucket/user.avatar/a.webp",
      `/api/storage/objects/${LEDGER_ID}`,
      "/images/default.png",
      "blob:http://localhost:3000/0f0e",
      "data:image/png;base64,AAAA",
    ]) {
      assert.equal(toStorageDisplaySrc(value, base), value);
    }
  });

  test("null・undefined・空は null", () => {
    assert.equal(toStorageDisplaySrc(null, base), null);
    assert.equal(toStorageDisplaySrc(undefined, base), null);
    assert.equal(toStorageDisplaySrc("", base), null);
  });
});

describe("contentTypes（受付と inline 表示の区別）", () => {
  test("inline は画像・動画・音声の固定表だけ", () => {
    for (const type of ["image/png", "image/jpeg", "image/webp", "video/mp4", "audio/mpeg", "IMAGE/PNG; x=1"]) {
      assert.equal(contentDispositionFor(type), "inline", type);
    }
  });

  test("HTML / SVG / XML と一般ファイル・不明な型は attachment", () => {
    for (const type of [
      "text/html",
      "image/svg+xml",
      "application/xml",
      "text/xml",
      "application/xhtml+xml",
      "application/pdf",
      "application/octet-stream",
      "text/plain",
      "application/javascript",
      "",
      null,
      "garbage",
    ]) {
      assert.equal(contentDispositionFor(type), "attachment", String(type));
    }
  });

  test("受付の照合は完全一致とワイルドカード", () => {
    assert.equal(matchesContentType("image/png", ["image/*"]), true);
    assert.equal(matchesContentType("image/svg+xml", ["image/*"]), true);
    assert.equal(matchesContentType("Image/PNG", ["image/png"]), true);
    assert.equal(matchesContentType("video/mp4", ["image/*"]), false);
    assert.equal(matchesContentType("imagex/png", ["image/*"]), false);
    assert.equal(matchesContentType(null, ["image/*"]), false);
    assert.equal(normalizeContentType("text/html; charset=utf-8"), "text/html");
  });

  test("拡張子は対応表から、表に無い型は bin", () => {
    assert.equal(extensionForContentType("image/jpeg"), "jpg");
    assert.equal(extensionForContentType("application/pdf"), "pdf");
    assert.equal(extensionForContentType("application/x-unknown"), "bin");
    assert.equal(extensionForContentType(null), "bin");
  });
});

describe("storageMediaValueSchema", () => {
  test("ref と http(s) だけを受ける", () => {
    assert.equal(storageMediaValueSchema.safeParse(PUB_REF).success, true);
    assert.equal(storageMediaValueSchema.safeParse("https://example.com/a.png").success, true);
    for (const value of ["storage://main/avatars/01.webp", "foo", "/local.png", "javascript:x", ""]) {
      assert.equal(storageMediaValueSchema.safeParse(value).success, false, value);
    }
  });
});

describe("fake ポート", () => {
  const loc = { bucket: "pub-bucket", path: `user.avatar/${LEDGER_ID}.webp` };

  test("差し替えると getStoragePort() が fake を返す", () => {
    const fake = createFakeStoragePort();
    __setStoragePortForTest(fake);
    assert.equal(getStoragePort(), fake);
  });

  test("PUT の発行 → 送信 → head。発行時は no-store、Disposition は型から決まる", async () => {
    const fake = createFakeStoragePort();
    const issued = await fake.issuePut(loc, { contentType: "image/webp", size: 3, maxBytes: 10, ttlSec: 900 });
    assert.equal(issued.headers["x-goog-if-generation-match"], "0");
    assert.equal(issued.headers["cache-control"], ISSUED_CACHE_CONTROL);
    fake.simulateUpload(issued.url, new Uint8Array([1, 2, 3]));
    const head = await fake.head(loc);
    assert.deepEqual(head, { size: 3, contentType: "image/webp", generation: "1" });
    const stored = fake.objects.get(`${loc.bucket}/${loc.path}`);
    assert.equal(stored?.cacheControl, "no-store");
    assert.equal(stored?.contentDisposition, "inline");
  });

  test("上書き不可・上限超過・型の不一致・期限切れは失敗する", async () => {
    let now = new Date("2026-10-22T00:00:00Z");
    const fake = createFakeStoragePort({ now: () => now });
    const first = await fake.issuePut(loc, { contentType: "image/webp", size: 1, maxBytes: 2, ttlSec: 60 });
    assert.throws(() => fake.simulateUpload(first.url, new Uint8Array(3)), (e: FakeStorageError) => e.code === 400);
    assert.throws(
      () => fake.simulateUpload(first.url, new Uint8Array(1), { contentType: "text/html" }),
      (e: FakeStorageError) => e.code === 403,
    );
    fake.simulateUpload(first.url, new Uint8Array(1));
    const second = await fake.issuePut(loc, { contentType: "image/webp", size: 1, maxBytes: 2, ttlSec: 60 });
    assert.throws(() => fake.simulateUpload(second.url, new Uint8Array(1)), (e: FakeStorageError) => e.code === 412);
    const other = { bucket: "pub-bucket", path: "user.avatar/other.webp" };
    const third = await fake.issuePut(other, { contentType: "image/webp", size: 1, maxBytes: 2, ttlSec: 60 });
    now = new Date(now.getTime() + 61_000);
    assert.throws(() => fake.simulateUpload(third.url, new Uint8Array(1)), (e: FakeStorageError) => e.code === 403);
  });

  test("セッションを中止すると URI は使えない（再中止も成功）", async () => {
    const fake = createFakeStoragePort();
    const { sessionUrl } = await fake.issueSession(loc, { contentType: "image/webp", size: 1 });
    await fake.cancelSession(sessionUrl);
    await fake.cancelSession(sessionUrl);
    assert.throws(() => fake.simulateUpload(sessionUrl, new Uint8Array(1)), (e: FakeStorageError) => e.code === 403);
    assert.equal(await fake.head(loc), null);
  });

  test("HTML を送ると attachment で保存される", async () => {
    const fake = createFakeStoragePort();
    const htmlLoc = { bucket: "priv-bucket", path: "chatRoom.file/x.bin" };
    const { sessionUrl } = await fake.issueSession(htmlLoc, { contentType: "text/html", size: 4 });
    fake.simulateUpload(sessionUrl, new Uint8Array(4));
    assert.equal(fake.objects.get(`${htmlLoc.bucket}/${htmlLoc.path}`)?.contentDisposition, "attachment");
  });

  test("世代指定: setCacheControl / copy / delete / signRead", async () => {
    const fake = createFakeStoragePort();
    const head = await fake.put(loc, new Uint8Array([9]), { contentType: "image/webp", cacheControl: "no-store" });
    await assert.rejects(fake.setCacheControl(loc, "999", "public"), (e: FakeStorageError) => e.code === 412);
    await fake.setCacheControl(loc, head.generation, "public, max-age=31536000, immutable");
    assert.equal(fake.objects.get(`${loc.bucket}/${loc.path}`)?.cacheControl, "public, max-age=31536000, immutable");

    const dst = { bucket: "pub-bucket", path: "user.avatar/copy.webp" };
    const copied = await fake.copy(loc, dst, { cacheControl: "no-store", sourceGeneration: head.generation });
    assert.equal(copied.size, 1);
    await assert.rejects(fake.copy(loc, dst, { cacheControl: "no-store" }), (e: FakeStorageError) => e.code === 412);
    await assert.rejects(
      fake.copy(loc, { bucket: "b", path: "c" }, { cacheControl: "no-store", sourceGeneration: "999" }),
      (e: FakeStorageError) => e.code === 404,
    );

    await fake.delete(loc, { generation: "999" });
    assert.notEqual(await fake.head(loc), null);
    await fake.delete(loc, { generation: head.generation });
    assert.equal(await fake.head(loc), null);
    await fake.delete(loc);

    const signed = await fake.signRead(dst, { ttlSec: 300, generation: copied.generation });
    assert.match(signed, /disposition=attachment/);
    assert.match(signed, new RegExp(`generation=${copied.generation}`));
  });
});

describe("未設定（env が空）", () => {
  test("保存先は即失敗し、既定バケットへ読み替えない", () => {
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = "legacy-bucket";
    assert.equal(isStorageStoreConfigured("pub"), false);
    assert.equal(isStorageStoreConfigured("priv"), false);
    assert.throws(() => locationOf("pub", "user.avatar/a.webp"), StorageNotConfiguredError);
    assert.throws(
      () => locationOf("priv", "x.y/a.png"),
      (e: StorageNotConfiguredError) => e.store === "priv" && e.missing.includes("STORAGE_PRIVATE_BUCKET"),
    );
  });

  test("設定すれば prefix 込みの位置になる", () => {
    process.env.STORAGE_PUBLIC_BUCKET = "pub-bucket";
    process.env.STORAGE_PRIVATE_BUCKET = "priv-bucket";
    process.env.STORAGE_PRIVATE_PREFIX = "/app";
    assert.deepEqual(locationOf("pub", "user.avatar/a.webp"), { bucket: "pub-bucket", path: "user.avatar/a.webp" });
    assert.deepEqual(getStoreConfig("priv"), { bucket: "priv-bucket", prefix: "app/" });
  });

  test("GCS ポートは構築できて、操作は FirebaseNotConfiguredError で即失敗", async () => {
    const port = getStoragePort();
    await assert.rejects(port.head({ bucket: "b", path: "p" }), FirebaseNotConfiguredError);
  });
});

describe("legacy（旧 URL の解析）", () => {
  test("自分の旧バケットの URL だけを位置にする", () => {
    assert.equal(parseLegacyStorageUrl("https://storage.googleapis.com/old/a.png"), null);
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = "old";
    assert.deepEqual(
      parseLegacyStorageUrl("https://firebasestorage.googleapis.com/v0/b/old/o/chat%2Froom1%2Fa.png?alt=media&token=t"),
      { bucket: "old", path: "chat/room1/a.png" },
    );
    assert.deepEqual(parseLegacyStorageUrl("https://storage.googleapis.com/old/avatars/a.png"), {
      bucket: "old",
      path: "avatars/a.png",
    });
    assert.equal(parseLegacyStorageUrl("https://storage.googleapis.com/other/a.png"), null);
    assert.equal(parseLegacyStorageUrl("http://storage.googleapis.com/old/a.png"), null);
    assert.equal(parseLegacyStorageUrl("https://example.com/old/a.png"), null);
    assert.equal(parseLegacyStorageUrl("https://firebasestorage.googleapis.com/v0/b/old/o/a%2F..%2Fb.png?alt=media"), null);
    assert.equal(parseLegacyStorageUrl(PUB_REF), null);
  });

  test("pub / priv の保存先と重なる位置は旧 URL と見なさない", () => {
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = "old";
    process.env.STORAGE_PRIVATE_BUCKET = "old";
    process.env.STORAGE_PRIVATE_PREFIX = "priv";
    process.env.STORAGE_PUBLIC_BUCKET = "pub-bucket";
    const managed = "https://firebasestorage.googleapis.com/v0/b/old/o/priv%2FchatRoom.image%2Fa.png?alt=media";
    assert.equal(parseLegacyStorageUrl(managed), null);
    assert.equal(isLegacyLocation({ bucket: "old", path: "priv/chatRoom.image/a.png" }), false);
    assert.deepEqual(parseLegacyStorageUrl("https://storage.googleapis.com/old/chat/a.png"), { bucket: "old", path: "chat/a.png" });
    assert.equal(isLegacyLocation({ bucket: "pub-bucket", path: "x.png" }), false);

    // prefix "" で同じバケット → 旧バケット全体が対象外
    process.env.STORAGE_PRIVATE_PREFIX = "";
    assert.equal(parseLegacyStorageUrl("https://storage.googleapis.com/old/chat/a.png"), null);
    assert.equal(isLegacyLocation({ bucket: "old", path: "chat/a.png" }), false);
  });
});

describe("purposes", () => {
  const map: StoragePurposeMap = {
    "user.avatar": {
      visibility: "public",
      maxBytes: 5 * 1024 * 1024,
      contentTypes: ["image/*"],
      upload: { allow: "authenticated" },
    },
    "purchaseRequest.bankProof": {
      visibility: "private",
      maxBytes: 10,
      contentTypes: [],
      upload: { allow: "authenticated" },
    },
  };

  test("未登録・形式違い・継承プロパティは 400", () => {
    assert.equal(resolveStoragePurpose(map, "user.avatar").visibility, "public");
    for (const id of ["user.cover", "toString", "__proto__"]) {
      assert.throws(
        () => resolveStoragePurpose(map, id),
        (e: StoragePurposeNotFoundError) => e instanceof StoragePurposeNotFoundError && e.status === 400,
        id,
      );
    }
  });

  test("形式の検査: private の read 欠落・空の contentTypes", () => {
    const problems = listStoragePurposeProblems(map);
    assert.equal(problems.length, 2);
    assert.ok(problems.some((p) => p.includes("read")));
    assert.ok(problems.some((p) => p.includes("contentTypes")));
  });
});

describe("AppImage（表示 src と最適化の判定）", () => {
  const PUB_BASE = "https://storage.googleapis.com/pub-bucket";
  const LEGACY_BUCKET = "old-bucket.firebasestorage.app";

  beforeEach(() => {
    process.env.NEXT_PUBLIC_STORAGE_PUBLIC_BASE_URL = `${PUB_BASE}/`;
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = LEGACY_BUCKET;
  });

  test("公開 base と固定 URL の判定", () => {
    assert.equal(publicStorageBaseUrl(), PUB_BASE);
    assert.equal(isPublicStorageUrl(`${PUB_BASE}/user.avatar/a.webp`), true);
    // 同じ共有ホストの別バケット・前方一致だけのバケット名は公開 base 配下ではない
    assert.equal(isPublicStorageUrl("https://storage.googleapis.com/other-bucket/a.webp"), false);
    assert.equal(isPublicStorageUrl("https://storage.googleapis.com/pub-bucket-evil/a.webp"), false);
    assert.equal(isPrivateObjectPath(`/api/storage/objects/${LEDGER_ID}`), true);
    assert.equal(isPrivateObjectPath(`/api/storage/objects/${LEDGER_ID}?_r=1`), true);
    assert.equal(isPrivateObjectPath("/images/a.png"), false);
    assert.equal(isPrivateObjectPath(null), false);
  });

  test("旧 URL はそのまま。自バケットは最適化可、他ホストは unoptimized", () => {
    const legacy = `https://firebasestorage.googleapis.com/v0/b/${LEGACY_BUCKET}/o/a.png?alt=media&token=t`;
    assert.deepEqual(resolveAppImageSource({ src: legacy }), { displaySrc: legacy, unoptimized: false });
    const other = "https://example.com/a.png";
    assert.deepEqual(resolveAppImageSource({ src: other }), { displaySrc: other, unoptimized: true });
    // "/" 始まり・blob: のプレビューは従来どおり素通し
    assert.deepEqual(resolveAppImageSource({ src: "/images/a.png" }), { displaySrc: "/images/a.png", unoptimized: false });
    assert.deepEqual(resolveAppImageSource({ src: "blob:http://localhost/x" }), {
      displaySrc: "blob:http://localhost/x",
      unoptimized: true,
    });
  });

  test("pub ref → 公開 base の URL（最適化可）。base が無ければ fallback", () => {
    assert.deepEqual(resolveAppImageSource({ src: PUB_REF }), {
      displaySrc: `${PUB_BASE}/user.avatar/${LEDGER_ID}.webp`,
      unoptimized: false,
    });
    assert.equal(isOptimizableSrc("https://storage.googleapis.com/other-bucket/a.webp"), false);
    delete process.env.NEXT_PUBLIC_STORAGE_PUBLIC_BASE_URL;
    assert.deepEqual(resolveAppImageSource({ src: PUB_REF, fallbackSrc: "/images/none.png" }), {
      displaySrc: "/images/none.png",
      unoptimized: false,
    });
  });

  test("priv ref → 固定 URL。呼び出し側が unoptimized={false} でも unoptimized", () => {
    const expected = { displaySrc: `/api/storage/objects/${LEDGER_ID}`, unoptimized: true };
    assert.deepEqual(resolveAppImageSource({ src: PRIV_REF }), expected);
    assert.deepEqual(resolveAppImageSource({ src: PRIV_REF, unoptimized: false }), expected);
    // "/" 始まりだが最適化は通さない（"/" 判定より先）
    assert.equal(isOptimizableSrc(`/api/storage/objects/${LEDGER_ID}`), false);
    // fallback 側に ref を渡しても同じ
    assert.deepEqual(resolveAppImageSource({ src: null, fallbackSrc: PRIV_REF, unoptimized: false }), expected);
  });

  test("空・解析できない ref・読み込み失敗は fallback、無ければ画像なし", () => {
    assert.deepEqual(resolveAppImageSource({ src: "" }), { displaySrc: undefined, unoptimized: undefined });
    assert.deepEqual(resolveAppImageSource({ src: "storage://main/x/y.png", fallbackSrc: "/f.png" }), {
      displaySrc: "/f.png",
      unoptimized: false,
    });
    assert.deepEqual(resolveAppImageSource({ src: PUB_REF, fallbackSrc: "/f.png", failed: true }), {
      displaySrc: "/f.png",
      unoptimized: false,
    });
  });

  test("動画の再取得 query は既存の query を残して足す", () => {
    assert.equal(withMediaRetryQuery(`/api/storage/objects/${LEDGER_ID}`, 5), `/api/storage/objects/${LEDGER_ID}?_r=5`);
    assert.equal(withMediaRetryQuery("/api/storage/objects/x?a=1", 5), "/api/storage/objects/x?a=1&_r=5");
  });
});
