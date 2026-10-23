// src/lib/dataMigration/dataMigrationMedia.test.ts
// dataMigration のメディア列の単体テスト（DB なし）。import の値の分類・解決と、export のメディア取得（ref の解決・skipped）。
// ファイル台帳の操作は偽の resolver。実 DB の往復は test:data-migration-db、resolver の実装は storageObject 側のテスト。
// 実行: pnpm test:data-migration

import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";

import { downloadChunkMedia } from "./export/createZip";
import { classifyMediaValue, MediaValueError, resolveMediaRow, splitMediaCell } from "./import/mediaValues";
import { contentTypeFromFilename, type DataMigrationMediaResolver } from "./media";

const LEGACY_BUCKET = "legacy-unit-bucket";
const REF_A = "storage://pub/sample.main_image/01920000-0000-7000-8000-000000000001.png";
const REF_B = "storage://pub/sample.main_image/01920000-0000-7000-8000-000000000002.png";
const PRIV_REF = "storage://priv/sample.secret/01920000-0000-7000-8000-000000000003.pdf";
const legacyUrl = (path: string) =>
  `https://firebasestorage.googleapis.com/v0/b/${LEGACY_BUCKET}/o/${encodeURIComponent(path)}?alt=media&token=t`;

const savedEnv: Record<string, string | undefined> = {};
before(() => {
  for (const name of ["NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", "STORAGE_PUBLIC_BUCKET", "STORAGE_PRIVATE_BUCKET"]) {
    savedEnv[name] = process.env[name];
  }
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = LEGACY_BUCKET;
  process.env.STORAGE_PUBLIC_BUCKET = "pub-unit-bucket";
  process.env.STORAGE_PRIVATE_BUCKET = "priv-unit-bucket";
});
after(() => {
  for (const [name, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

type Call = { op: string; source?: string; purpose: string; scopeId: string | null; contentType?: string };

function fakeResolver(options: { failCopy?: (source: string) => boolean } = {}) {
  const calls: Call[] = [];
  let counter = 0;
  const media: DataMigrationMediaResolver = {
    async putAsset({ purpose, contentType, scopeId }) {
      calls.push({ op: "put", purpose, scopeId, contentType });
      return `storage://pub/${purpose}/01920000-0000-7000-8000-${String(900 + ++counter).padStart(12, "0")}.png`;
    },
    async copy({ source, purpose, scopeId }) {
      calls.push({ op: "copy", source, purpose, scopeId });
      if (options.failCopy?.(source)) throw new Error("複製元のファイルが見つかりません");
      return `storage://pub/${purpose}/01920000-0000-7000-8000-${String(800 + ++counter).padStart(12, "0")}.png`;
    },
    async resolveExportUrl() {
      return null;
    },
  };
  return { media, calls };
}

describe("import: 値の分類", () => {
  test("空・既存と同じ・同梱・今回の ref・他の ref・旧 URL・外部 URL・/ 始まり・解釈できない値", () => {
    const uploaded = new Set([REF_B]);
    assert.equal(classifyMediaValue("", [], uploaded), "empty");
    assert.equal(classifyMediaValue(REF_A, [REF_A], uploaded), "keep");
    assert.equal(classifyMediaValue("https://example.com/a.png", ["https://example.com/a.png"], uploaded), "keep");
    assert.equal(classifyMediaValue("assets/main_image/x.png", [], uploaded), "asset");
    assert.equal(classifyMediaValue(REF_B, [], uploaded), "uploaded");
    assert.equal(classifyMediaValue(REF_A, [], uploaded), "copy");
    assert.equal(classifyMediaValue(legacyUrl("sample/a.png"), [], uploaded), "copy");
    assert.equal(classifyMediaValue("https://example.com/a.png", [], uploaded), "invalid");
    assert.equal(
      classifyMediaValue("https://firebasestorage.googleapis.com/v0/b/other-bucket/o/a.png?alt=media", [], uploaded),
      "invalid",
      "他バケットの URL は旧 URL として扱わない",
    );
    assert.equal(classifyMediaValue("/images/a.png", [], uploaded), "invalid");
    assert.equal(classifyMediaValue("storage://pub/broken", [], uploaded), "invalid");
    assert.equal(classifyMediaValue("hello", [], uploaded), "invalid");
  });

  test("multi のセルはカンマで分け、単一列は分けない", () => {
    assert.deepEqual(splitMediaCell(`${REF_A}, ${REF_B}`, true), [REF_A, REF_B]);
    assert.deepEqual(splitMediaCell("", true), []);
    assert.deepEqual(splitMediaCell(null, false), []);
    assert.deepEqual(splitMediaCell("a,b", false), ["a,b"]);
  });

  test("ZIP の拡張子から MIME タイプを推測する", () => {
    assert.equal(contentTypeFromFilename("x.JPG"), "image/jpeg");
    assert.equal(contentTypeFromFilename("x.mp4"), "video/mp4");
    assert.equal(contentTypeFromFilename("x"), "application/octet-stream");
  });
});

describe("import: 1 行の解決", () => {
  const fields = [
    { name: "main_image", purpose: "sample.main_image" },
    { name: "gallery_images", purpose: "sample.gallery_images", multi: true },
  ];
  const base = { rowNumber: 3, existing: null, scopeRow: {}, fields, assets: new Map(), uploadedRefs: new Set<string>() };

  test("同梱は putAsset、旧 URL と他の ref は copy、今回の ref と同じ値はそのまま。CSV に無い列は触らない", async () => {
    const { media, calls } = fakeResolver();
    const resolved = await resolveMediaRow({
      ...base,
      record: { main_image: "assets/main_image/r1.webp" },
      assets: new Map([["main_image/r1.webp", new Uint8Array([1])]]),
      media,
    });
    assert.ok(String(resolved.main_image).startsWith("storage://pub/sample.main_image/"));
    assert.equal("gallery_images" in resolved, false, "CSV に無い列は戻り値に入れない");
    assert.deepEqual(calls.map((c) => [c.op, c.contentType]), [["put", "image/webp"]]);

    const second = fakeResolver();
    const multi = await resolveMediaRow({
      ...base,
      record: { gallery_images: `${legacyUrl("g/1.png")},${REF_A},${REF_B}` },
      uploadedRefs: new Set([REF_B]),
      media: second.media,
    });
    const gallery = multi.gallery_images as string[];
    assert.equal(gallery.length, 3);
    assert.equal(gallery[2], REF_B, "今回アップロードした ref はそのまま");
    assert.notEqual(gallery[1], REF_A, "他の ref は複製して新しい ref にする");
    assert.deepEqual(second.calls.map((c) => [c.op, c.source]), [
      ["copy", legacyUrl("g/1.png")],
      ["copy", REF_A],
    ]);
  });

  test("既存行の今の値と同じなら、旧 URL でも外部 URL でもそのまま（複製しない）", async () => {
    const { media, calls } = fakeResolver();
    const resolved = await resolveMediaRow({
      ...base,
      record: { main_image: "https://example.com/old.png" },
      existing: { main_image: "https://example.com/old.png" },
      media,
    });
    assert.equal(resolved.main_image, "https://example.com/old.png");
    assert.equal(calls.length, 0);
  });

  test("空は null（multi は []）", async () => {
    const { media } = fakeResolver();
    const resolved = await resolveMediaRow({ ...base, record: { main_image: "", gallery_images: null }, media });
    assert.deepEqual(resolved, { main_image: null, gallery_images: [] });
  });

  test("外部 URL・/ 始まり・同梱なし・複製失敗は、行・列・値つきの MediaValueError", async () => {
    const { media } = fakeResolver({ failCopy: (source) => source.includes("missing") });
    const cases: [Record<string, unknown>, string][] = [
      [{ main_image: "https://example.com/a.png" }, "外部 URL"],
      [{ main_image: "/static/a.png" }, "取り込めない値"],
      [{ main_image: "assets/main_image/none.png" }, "同梱ファイルがありません"],
      [{ gallery_images: `${legacyUrl("ok.png")},${legacyUrl("missing.png")}` }, "複製できません"],
    ];
    for (const [record, reason] of cases) {
      await assert.rejects(
        resolveMediaRow({ ...base, record, media }),
        (error: unknown) =>
          error instanceof MediaValueError &&
          error.rowNumber === 3 &&
          error.message.includes("データ行 3") &&
          error.message.includes(reason),
        reason,
      );
    }
  });

  test("scope 付きの列は、行から scope を計算して渡す", async () => {
    const { media, calls } = fakeResolver();
    await resolveMediaRow({
      ...base,
      fields: [{ name: "proof", purpose: "purchaseRequest.bankProof", scope: (row) => String(row.request_id) }],
      record: { proof: legacyUrl("p.png") },
      scopeRow: { request_id: "req-1" },
      media,
    });
    assert.equal(calls[0].scopeId, "req-1");
  });
});

describe("export: メディアの取得", () => {
  const realFetch = globalThis.fetch;
  const served = new Map<string, Uint8Array>();
  before(() => {
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      const body = served.get(url);
      return body ? new Response(new Uint8Array(body), { status: 200 }) : new Response("nf", { status: 404 });
    }) as typeof fetch;
  });
  after(() => {
    globalThis.fetch = realFetch;
  });

  test("ref は resolver で解決して ZIP に入れ、multi は <id>_<n>、取れない値は元の値のまま skipped に数える", async () => {
    served.set("https://pub.example/sample.main_image/a.png", new Uint8Array([1]));
    served.set("https://legacy.example/g1.jpg", new Uint8Array([2]));
    served.set("https://signed.example/secret?sig=1", new Uint8Array([3]));
    const urls: Record<string, string | null> = {
      [REF_A]: "https://pub.example/sample.main_image/a.png",
      [PRIV_REF]: "https://signed.example/secret?sig=1",
      [REF_B]: null, // 読み取り権限なし
    };
    const resolveUrl = async (value: string) =>
      value.startsWith("http") ? value : value in urls ? urls[value] : null;

    const records = [
      { id: "r1", main_image: REF_A, gallery_images: ["https://legacy.example/g1.jpg", REF_B, PRIV_REF] },
      { id: "r2", main_image: "/static/x.png", gallery_images: [] },
    ];
    const result = await downloadChunkMedia(
      records,
      [
        { name: "main_image", multi: false },
        { name: "gallery_images", multi: true },
      ],
      "sample/chunk_001",
      { domain: "sample", resolveUrl },
    );

    assert.deepEqual(result.zipEntries.map((e) => e.path).sort(), [
      "sample/chunk_001/assets/gallery_images/r1_1.jpg",
      "sample/chunk_001/assets/gallery_images/r1_3.pdf",
      "sample/chunk_001/assets/main_image/r1.png",
    ]);
    assert.equal(result.modifiedRecords[0].main_image, "assets/main_image/r1.png");
    assert.deepEqual(result.modifiedRecords[0].gallery_images, [
      "assets/gallery_images/r1_1.jpg",
      REF_B,
      "assets/gallery_images/r1_3.pdf",
    ]);
    assert.equal(result.modifiedRecords[1].main_image, "/static/x.png");
    assert.equal(result.skipped.count, 2);
    assert.deepEqual(result.skipped.examples, ["sample/r1/gallery_images[2]", "sample/r2/main_image"]);
    assert.deepEqual(records[0].gallery_images[0], "https://legacy.example/g1.jpg", "元のレコードは書き換えない");
  });

  test("取得に失敗した http の値も skipped", async () => {
    const result = await downloadChunkMedia(
      [{ id: "r1", main_image: "https://gone.example/a.png" }],
      [{ name: "main_image", multi: false }],
      "chunk_001",
      { domain: "sample", resolveUrl: async (v) => v },
    );
    assert.equal(result.zipEntries.length, 0);
    assert.equal(result.skipped.count, 1);
    assert.equal(result.modifiedRecords[0].main_image, "https://gone.example/a.png");
  });
});
