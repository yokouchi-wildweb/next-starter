// src/lib/storage/client/shrinkImage.test.ts
// 送る前の縮小（shrinkImage.ts）の単体テスト。描き直しは偽の codec、用途の方針は偽の loader で置き換える。
// 実行: pnpm test src/lib/storage/client/shrinkImage.test.ts

import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { STORAGE_CONFIG } from "@/config/app/storage.config";

import type { PurposePolicy } from "./purposePolicy";
import { fitWithin, type ImageCodec } from "./reencodeImage";
import { shrinkImageFile, shrinkImageForPurpose } from "./shrinkImage";

type ResizeCall = { type: string; quality: number; maxDimension: number };

/** 長い辺 longest の画像として振る舞う偽の codec。縮めた物は元の半分の大きさの Blob */
function fakeCodec(longest: number, overrides: Partial<ImageCodec> = {}) {
  const calls: ResizeCall[] = [];
  const codec: ImageCodec = {
    available: () => true,
    redraw: async (file, type) => new Blob([file], { type }),
    resize: async (file, type, quality, maxDimension) => {
      calls.push({ type, quality, maxDimension });
      if (longest <= maxDimension) return null;
      return new Blob([new Uint8Array(Math.floor(file.size / 2))], { type });
    },
    ...overrides,
  };
  return { codec, calls };
}

const fileOf = (type: string, size = 1000, name = "photo.jpg") =>
  new File([new Uint8Array(size)], name, { type, lastModified: 1_700_000_000_000 });

describe("fitWithin（長い辺を上限に収める大きさ）", () => {
  test("収まっていれば null、超えれば縦横比を保って長い辺を上限に", () => {
    assert.equal(fitWithin(2000, 1000, 2000), null);
    assert.deepEqual(fitWithin(4000, 3000, 2000), { width: 2000, height: 1500 });
    assert.deepEqual(fitWithin(3000, 4000, 2000), { width: 1500, height: 2000 });
    assert.deepEqual(fitWithin(10000, 1, 100), { width: 100, height: 1 });
  });
});

describe("shrinkImageFile", () => {
  test("長い辺が上限を超える jpeg / png / webp を縮め、同じ型・名前・更新日時で返す", async () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      const { codec, calls } = fakeCodec(4000);
      const original = fileOf(type);
      const shrunk = await shrinkImageFile(original, { maxDimension: 2000 }, codec);
      assert.notEqual(shrunk, original, type);
      assert.equal(shrunk.size, 500, type);
      assert.equal(shrunk.type, type);
      assert.equal(shrunk.name, "photo.jpg");
      assert.equal(shrunk.lastModified, original.lastModified);
      assert.equal(calls[0].maxDimension, 2000);
    }
  });

  test("画質: 指定は /100、省略は storage.config の型ごとの値、png は 1", async () => {
    const run = async (type: string, quality?: number) => {
      const { codec, calls } = fakeCodec(4000);
      await shrinkImageFile(fileOf(type), { maxDimension: 2000, quality }, codec);
      return calls[0].quality;
    };
    assert.equal(await run("image/jpeg", 80), 0.8);
    assert.equal(await run("image/jpeg"), STORAGE_CONFIG.imageStrip.quality.jpeg / 100);
    assert.equal(await run("image/webp"), STORAGE_CONFIG.imageStrip.quality.webp / 100);
    assert.equal(await run("image/png", 50), 1);
  });

  test("元のまま: 対象外の型（画像以外・gif・svg・avif・HEIC・型なし）は codec を呼ばない", async () => {
    for (const type of ["application/pdf", "video/mp4", "image/gif", "image/svg+xml", "image/avif", "image/heic", ""]) {
      const { codec, calls } = fakeCodec(4000);
      const original = fileOf(type);
      assert.equal(await shrinkImageFile(original, { maxDimension: 2000 }, codec), original, type);
      assert.equal(calls.length, 0, type);
    }
  });

  test("元のまま: 長い辺が上限以下", async () => {
    const { codec } = fakeCodec(2000);
    const original = fileOf("image/jpeg");
    assert.equal(await shrinkImageFile(original, { maxDimension: 2000 }, codec), original);
  });

  test("元のまま: 縮められない環境（available が false・resize の無い codec）", async () => {
    const original = fileOf("image/jpeg");
    assert.equal(await shrinkImageFile(original, { maxDimension: 10 }, fakeCodec(4000, { available: () => false }).codec), original);
    const { resize: _ignored, ...withoutResize } = fakeCodec(4000).codec;
    assert.equal(await shrinkImageFile(original, { maxDimension: 10 }, withoutResize), original);
  });

  test("元のまま: 読めない・書き出せない（投げない）、別の型になった、縮めて大きくなった", async () => {
    const original = fileOf("image/webp");
    const warn = console.warn;
    console.warn = () => undefined;
    try {
      const throwing = fakeCodec(4000, { resize: async () => { throw new Error("decode"); } }).codec;
      assert.equal(await shrinkImageFile(original, { maxDimension: 10 }, throwing), original);
    } finally {
      console.warn = warn;
    }
    const otherType = fakeCodec(4000, { resize: async () => new Blob([new Uint8Array(10)], { type: "image/png" }) }).codec;
    assert.equal(await shrinkImageFile(original, { maxDimension: 10 }, otherType), original);
    const bigger = fakeCodec(4000, { resize: async () => new Blob([new Uint8Array(2000)], { type: "image/webp" }) }).codec;
    assert.equal(await shrinkImageFile(original, { maxDimension: 10 }, bigger), original);
  });
});

describe("shrinkImageForPurpose", () => {
  const loaderOf = (answers: Record<string, PurposePolicy>) => {
    const calls: string[] = [];
    return {
      calls,
      loader: {
        loadPolicy: async (purpose: string) => {
          calls.push(purpose);
          const policy = answers[purpose];
          if (!policy) throw new Error("404");
          return policy;
        },
      },
    };
  };

  test("strip で image がある用途だけ、その指定で縮める", async () => {
    const { loader } = loaderOf({ "album.photo": { metadata: "strip", image: { maxDimension: 1600, quality: 70 } } });
    const { codec, calls } = fakeCodec(4000);
    const shrunk = await shrinkImageForPurpose(fileOf("image/jpeg"), "album.photo", { loader, codec });
    assert.equal(shrunk.size, 500);
    assert.deepEqual(calls, [{ type: "image/jpeg", quality: 0.7, maxDimension: 1600 }]);
  });

  test("元のまま: image が null・keep・方針の取得に失敗・purpose が無い・対象外の型（方針を聞かない）", async () => {
    const { loader, calls } = loaderOf({
      "album.plain": { metadata: "strip", image: null },
      "album.keep": { metadata: "keep", image: { maxDimension: 10 } },
    });
    const { codec } = fakeCodec(4000);
    const original = fileOf("image/jpeg");
    for (const purpose of ["album.plain", "album.keep", "album.missing", null, undefined]) {
      assert.equal(await shrinkImageForPurpose(original, purpose, { loader, codec }), original, String(purpose));
    }
    const pdf = fileOf("application/pdf");
    calls.length = 0;
    assert.equal(await shrinkImageForPurpose(pdf, "album.plain", { loader, codec }), pdf);
    assert.deepEqual(calls, []);
  });
});
