// src/components/Media/AppImage/source.test.ts
// AppImage の表示 src と最適化の判定(resolveAppImageSource・isOptimizableSrc)。storage:// の ref の解決は lib/storage の物を使う
// (lib/storage の側の判定のテストは src/lib/storage/storageRef.test.ts)
// 実行: pnpm test src/components/Media/AppImage/source.test.ts

import { afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";

import { isOptimizableSrc } from "./optimizable";
import { resolveAppImageSource } from "./source";

const LEDGER_ID = "01920000-0000-7000-8000-000000000001";
const PUB_REF = `storage://pub/user.avatar/${LEDGER_ID}.webp`;
const PRIV_REF = `storage://priv/purchaseRequest.bankProof/${LEDGER_ID}.png`;
const ENV_KEYS = ["NEXT_PUBLIC_STORAGE_PUBLIC_BASE_URL", "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"] as const;
const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

describe("AppImage（表示 src と最適化の判定）", () => {
  const PUB_BASE = "https://storage.googleapis.com/pub-bucket";
  const LEGACY_BUCKET = "old-bucket.firebasestorage.app";

  beforeEach(() => {
    for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
    process.env.NEXT_PUBLIC_STORAGE_PUBLIC_BASE_URL = `${PUB_BASE}/`;
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = LEGACY_BUCKET;
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
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
});
