// src/lib/storage/server/imageStrip.test.ts
// 画像の描き直し（stripImageMetadata）の単体テスト。実 sharp と合成画像で、メタデータの全除去・向き・
// アニメーションの保持・申告との照合・画素数の上限を確かめる。
// 実行: pnpm test:storage-strip

import { describe, test } from "node:test";
import assert from "node:assert/strict";

import sharp from "sharp";

import { ImageStripError, stripImageMetadata, type ImageStripOptions } from "./imageStrip";

const OPTIONS: ImageStripOptions = {
  maxFramePixels: 100_000_000,
  maxTotalPixels: 100_000_000,
  quality: { jpeg: 90, webp: 90, avif: 60 },
};

const GPS_EXIF = {
  IFD0: { Copyright: "secret-owner", Make: "TestCam" },
  IFD3: { GPSLatitudeRef: "N", GPSLatitude: "35/1 41/1 22/1", GPSLongitudeRef: "E", GPSLongitude: "139/1 41/1 30/1" },
};

const XMP = `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator>secret-creator</dc:creator></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;

/** 単色（左半分と右半分で色を変える）の RGBA 画像 */
function twoTone(width: number, height: number, left: number[], right: number[]): sharp.Sharp {
  const raw = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      raw.set(x < width / 2 ? left : right, (y * width + x) * 4);
    }
  }
  return sharp(raw, { raw: { width, height, channels: 4 } });
}

/** JPEG の SOI の直後に IPTC（APP13 / Photoshop 3.0）の区画を差し込む（sharp は IPTC を書けないため） */
function withIptc(jpeg: Buffer): Buffer {
  const payload = Buffer.concat([
    Buffer.from("Photoshop 3.0\0", "latin1"),
    Buffer.from("8BIM", "latin1"),
    Buffer.from([0x04, 0x04, 0x00, 0x00]),
    Buffer.from([0x00, 0x00, 0x00, 0x14]),
    Buffer.from([0x1c, 0x02, 0x50, 0x00, 0x0e]),
    Buffer.from("secret-byline!", "latin1"),
    Buffer.from([0x00]),
  ]);
  const length = payload.length + 2;
  const segment = Buffer.concat([Buffer.from([0xff, 0xed, length >> 8, length & 0xff]), payload]);
  return Buffer.concat([jpeg.subarray(0, 2), segment, jpeg.subarray(2)]);
}

/** フレームを並べたアニメーション（各フレーム = 左右 2 色） */
async function animated(format: "gif" | "webp", frames: number[][][], options: { orientation?: number } = {}) {
  const buffers = await Promise.all(frames.map(([l, r]) => twoTone(8, 4, l, r).png().toBuffer()));
  let pipeline = sharp(buffers, { join: { animated: true } });
  pipeline =
    format === "gif"
      ? pipeline.gif({ loop: 3, delay: frames.map((_, i) => 100 * (i + 1)) })
      : pipeline.webp({ loop: 3, delay: frames.map((_, i) => 100 * (i + 1)), lossless: true });
  if (options.orientation) pipeline = pipeline.withMetadata({ orientation: options.orientation });
  return pipeline.toBuffer();
}

/** フレーム page（既定 0）の (x, y) の RGBA */
async function pixelAt(image: Uint8Array, x: number, y: number, page = 0): Promise<number[]> {
  const { data, info } = await sharp(image, { page }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const offset = (y * info.width + x) * info.channels;
  return [...data.subarray(offset, offset + 4)];
}

/** 色がほぼ同じか（非可逆の再エンコードの誤差を許す） */
function assertColor(actual: number[], expected: number[]) {
  assert.ok(
    actual.every((v, i) => Math.abs(v - expected[i]) <= 8),
    `色が違います: ${actual.join(",")} ≠ ${expected.join(",")}`,
  );
}

function assertNoMetadata(meta: sharp.Metadata) {
  assert.equal(meta.exif, undefined, "EXIF が残っている");
  assert.equal(meta.xmp, undefined, "XMP が残っている");
  assert.equal(meta.iptc, undefined, "IPTC が残っている");
  assert.equal(meta.icc, undefined, "ICC が残っている");
  assert.equal(meta.orientation, undefined, "向きのタグが残っている");
}

function rejectsKind(kind: ImageStripError["kind"]) {
  return (error: unknown) => error instanceof ImageStripError && error.kind === kind;
}

const RED = [255, 0, 0, 255];
const BLUE = [0, 0, 255, 255];
const CLEAR = [0, 0, 0, 0];

describe("メタデータの全除去", () => {
  test("GPS 入り EXIF・XMP・IPTC・ICC（Display P3）の JPEG → 全て消え、sRGB の JPEG になる", async () => {
    const jpeg = withIptc(
      await twoTone(16, 16, RED, BLUE).flatten().jpeg().withExif(GPS_EXIF).withXmp(XMP).withIccProfile("p3").toBuffer(),
    );
    const before = await sharp(jpeg).metadata();
    assert.ok(before.exif && before.xmp && before.iptc && before.icc, "前提: 入力にメタデータが入っている");

    const result = await stripImageMetadata(jpeg, "image/jpeg", OPTIONS);
    assert.equal(result.contentType, "image/jpeg");
    const after = await sharp(result.body).metadata();
    assert.equal(after.format, "jpeg");
    assert.equal(after.space, "srgb");
    assertNoMetadata(after);
    const text = Buffer.from(result.body).toString("latin1");
    for (const secret of ["secret-owner", "secret-creator", "secret-byline", "TestCam", "Photoshop 3.0"]) {
      assert.equal(text.includes(secret), false, `${secret} が残っている`);
    }
  });

  test("PNG・WebP・AVIF の EXIF も消え、形式は入力のまま", async () => {
    for (const [type, format, encode] of [
      ["image/png", "png", (p: sharp.Sharp) => p.png()],
      ["image/webp", "webp", (p: sharp.Sharp) => p.webp()],
      ["image/avif", "heif", (p: sharp.Sharp) => p.avif()],
    ] as const) {
      const input = await encode(twoTone(16, 16, RED, BLUE)).withExif(GPS_EXIF).toBuffer();
      assert.ok((await sharp(input).metadata()).exif, `前提: ${type} に EXIF が入っている`);
      const result = await stripImageMetadata(input, type, OPTIONS);
      const after = await sharp(result.body).metadata();
      assert.equal(after.format, format, type);
      if (type === "image/avif") assert.equal(after.compression, "av1");
      assertNoMetadata(after);
    }
  });
});

describe("向き", () => {
  test("静止画の向き 6 → 回転して縦横が入れ替わり、タグは消える", async () => {
    const input = await twoTone(40, 20, RED, BLUE).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const result = await stripImageMetadata(input, "image/jpeg", OPTIONS);
    const after = await sharp(result.body).metadata();
    assert.equal(after.width, 20);
    assert.equal(after.height, 40);
    assertNoMetadata(after);
  });

  test("アニメーションの向き 6 → 回転せず向きの情報を捨てる。フレームは保つ", async () => {
    const input = await animated("webp", [[RED, BLUE], [BLUE, RED]], { orientation: 6 });
    const before = await sharp(input, { animated: true }).metadata();
    assert.equal(before.orientation, 6, "前提: 入力に向き 6 が入っている");
    assert.equal(before.pages, 2);

    const result = await stripImageMetadata(input, "image/webp", OPTIONS);
    const after = await sharp(result.body, { animated: true }).metadata();
    assert.equal(after.pages, 2);
    assert.equal(after.width, 8);
    assert.equal(after.pageHeight, 4);
    assertNoMetadata(after);
    assertColor(await pixelAt(result.body, 0, 0), RED);
  });

  test("アニメーションの向き 3 → 180 度に補正する", async () => {
    // 同じフレームが続くと WebP の符号化で 1 枚にまとまるため、2 枚目は変える
    const input = await animated("webp", [[RED, BLUE], [CLEAR, RED]], { orientation: 3 });
    const before = await sharp(input, { animated: true }).metadata();
    assert.equal(before.orientation, 3, "前提: 入力に向き 3 が入っている");
    const result = await stripImageMetadata(input, "image/webp", OPTIONS);
    const after = await sharp(result.body, { animated: true }).metadata();
    assert.equal(after.pages, 2);
    assert.equal(after.loop, before.loop);
    assert.deepEqual(after.delay, before.delay);
    assertNoMetadata(after);
    // 1 枚目: 左が赤・右が青 → 180 度で左が青（フレームの順番は変わらない）
    assertColor(await pixelAt(result.body, 0, 0), BLUE);
    assertColor(await pixelAt(result.body, 7, 0), RED);
    // 2 枚目: 左が透明・右が赤 → 左が赤
    assertColor(await pixelAt(result.body, 0, 0, 1), RED);
  });

  test("アニメーションの向き 4 → 上下を返しても、フレームの順番とコマ間隔は変わらない", async () => {
    const input = await animated("webp", [[RED, RED], [BLUE, BLUE]], { orientation: 4 });
    const before = await sharp(input, { animated: true }).metadata();
    assert.equal(before.orientation, 4, "前提: 入力に向き 4 が入っている");
    const result = await stripImageMetadata(input, "image/webp", OPTIONS);
    const after = await sharp(result.body, { animated: true }).metadata();
    assert.equal(after.pages, 2);
    assert.deepEqual(after.delay, before.delay);
    assertNoMetadata(after);
    assertColor(await pixelAt(result.body, 0, 0), RED);
    assertColor(await pixelAt(result.body, 0, 0, 1), BLUE);
  });
});

describe("アニメーションの保持", () => {
  test("GIF: フレーム数・ループ・コマ間隔・透過が同じ", async () => {
    const input = await animated("gif", [[RED, CLEAR], [CLEAR, BLUE], [RED, BLUE]]);
    const before = await sharp(input, { animated: true }).metadata();
    const result = await stripImageMetadata(input, "image/gif", OPTIONS);
    const after = await sharp(result.body, { animated: true }).metadata();
    assert.equal(after.format, "gif");
    assert.equal(after.pages, 3);
    assert.equal(after.loop, before.loop);
    assert.deepEqual(after.delay, before.delay);
    assert.equal(after.hasAlpha, true);
    assert.equal((await pixelAt(result.body, 7, 0))[3], 0, "透過が失われている");
  });

  test("WebP: フレーム数・ループ・コマ間隔が同じ", async () => {
    const input = await animated("webp", [[RED, BLUE], [BLUE, RED], [RED, RED]]);
    const before = await sharp(input, { animated: true }).metadata();
    const result = await stripImageMetadata(input, "image/webp", OPTIONS);
    const after = await sharp(result.body, { animated: true }).metadata();
    assert.equal(after.pages, 3);
    assert.equal(after.loop, before.loop);
    assert.deepEqual(after.delay, before.delay);
  });
});

describe("照合と上限", () => {
  test("申告と実際の形式が違えば type_mismatch", async () => {
    const png = await twoTone(4, 4, RED, BLUE).png().toBuffer();
    await assert.rejects(stripImageMetadata(png, "image/jpeg", OPTIONS), rejectsKind("type_mismatch"));
    const heic = await twoTone(4, 4, RED, BLUE).avif().toBuffer();
    await assert.rejects(stripImageMetadata(heic, "image/webp", OPTIONS), rejectsKind("type_mismatch"));
  });

  test("画像として読めない物・描き直せない型は unprocessable", async () => {
    await assert.rejects(stripImageMetadata(new Uint8Array([1, 2, 3]), "image/png", OPTIONS), rejectsKind("unprocessable"));
    const jpeg = await twoTone(4, 4, RED, BLUE).jpeg().toBuffer();
    await assert.rejects(stripImageMetadata(jpeg, "image/heic", OPTIONS), rejectsKind("unprocessable"));
    await assert.rejects(stripImageMetadata(jpeg, "image/svg+xml", OPTIONS), rejectsKind("unprocessable"));
  });

  test("1 フレームの画素数・全フレームの合計の上限を超えたら too_large（ちょうどは通る）", async () => {
    const jpeg = await twoTone(10, 10, RED, BLUE).jpeg().toBuffer();
    await stripImageMetadata(jpeg, "image/jpeg", { ...OPTIONS, maxFramePixels: 100 });
    await assert.rejects(
      stripImageMetadata(jpeg, "image/jpeg", { ...OPTIONS, maxFramePixels: 99 }),
      rejectsKind("too_large"),
    );

    // 8 × 4 = 32 画素 × 3 フレーム = 96 画素
    const gif = await animated("gif", [[RED, BLUE], [BLUE, RED], [RED, RED]]);
    await stripImageMetadata(gif, "image/gif", { ...OPTIONS, maxTotalPixels: 96 });
    await assert.rejects(stripImageMetadata(gif, "image/gif", { ...OPTIONS, maxTotalPixels: 95 }), rejectsKind("too_large"));
  });
});
