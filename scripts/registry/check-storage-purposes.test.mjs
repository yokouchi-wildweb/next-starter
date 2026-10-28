// ファイル用途の登録表（src/registry/storagePurposeRegistry.ts）と生成器の検査。
// - 登録表の全用途（手書きの CORE / FORK を含む）が ID の形式・型・規則に合う
// - 全 domain.json（business と core の設定源）のメディア項目に、対応する用途が登録されている
// - 生成器の導出（visibility の必須化・上限の既定値・metadata の検査と書き出し・AUTO ブロックだけの upsert）
// - 用途の metadata（strip / keep）の規則と、user.avatar が keep でないこと（D29）
// - storage オプションのメディア列は systemColumns・hiddenColumns にできない（登録済みの全サービスが作れることも確かめる）
// 実行: pnpm test:storage-purposes
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  applyStoragePurposeEntries,
  buildStoragePurposeEntries,
  removeStoragePurposeEntries,
  syncStorageConfigImport,
} from "../domain-config/render/registry/storagePurpose/index.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const MEDIA_FIELD_TYPES = new Set(["mediaUploader", "mediaUploaderMulti"]);

const { storagePurposeRegistry } = await import("../../src/registry/storagePurposeRegistry.ts");
const { listStoragePurposeProblems } = await import("../../src/lib/storage/server/purposes.ts");
const { isValidStoragePurposeId } = await import("../../src/lib/storage/ref.ts");
const { FIXED_STRIP_PURPOSES } = await import("../../src/features/core/storageObject/services/server/purposeSource.ts");

/** src/features/<domain>/domain.json と src/features/core/<domain>/domain.json（ドメイン名 = フォルダ名） */
function listDomainConfigs() {
  const result = [];
  for (const base of [path.join(rootDir, "src", "features"), path.join(rootDir, "src", "features", "core")]) {
    for (const dirent of fs.readdirSync(base, { withFileTypes: true })) {
      if (!dirent.isDirectory()) continue;
      const file = path.join(base, dirent.name, "domain.json");
      if (fs.existsSync(file)) result.push({ domain: dirent.name, config: JSON.parse(fs.readFileSync(file, "utf8")) });
    }
  }
  return result;
}

describe("登録表", () => {
  test("全用途が ID の形式・型・規則に合う", () => {
    assert.deepEqual(listStoragePurposeProblems(storagePurposeRegistry), []);
    for (const id of Object.keys(storagePurposeRegistry)) {
      assert.equal(isValidStoragePurposeId(id), true, id);
    }
  });

  test("全 domain.json のメディア項目に用途が登録されている", () => {
    const missing = [];
    for (const { domain, config } of listDomainConfigs()) {
      for (const field of config.fields ?? []) {
        if (!MEDIA_FIELD_TYPES.has(field.fieldType)) continue;
        const id = `${domain}.${field.name}`;
        if (!(id in storagePurposeRegistry)) missing.push(id);
      }
    }
    assert.deepEqual(missing, [], `未登録の用途: ${missing.join(", ")}（dc:generate を実行するか、core は storagePurposes/core.ts に書く）`);
  });

  test("core の手書き用途がそろっている", () => {
    for (const id of [
      "user.avatar",
      "chatRoom.image",
      "chatRoom.video",
      "chatRoom.file",
      "purchaseRequest.bankProof",
      "notification.image",
      "coupon.image_url",
      "demo.media",
    ]) {
      assert.ok(id in storagePurposeRegistry, id);
    }
  });

  test("user.avatar は keep でない（D29）", () => {
    assert.notEqual(storagePurposeRegistry["user.avatar"].metadata, "keep");
    for (const id of FIXED_STRIP_PURPOSES) {
      assert.notEqual(storagePurposeRegistry[id]?.metadata, "keep", id);
    }
  });
});

describe("用途の metadata の検査（listStoragePurposeProblems）", () => {
  const base = { visibility: "public", maxBytes: 10, upload: { allow: "authenticated" } };
  const problemsOf = (id, purpose) => listStoragePurposeProblems({ [id]: { ...base, ...purpose } });

  test("strip / keep / 省略はどれも通る（画像の型は image/* と 5 型）", () => {
    for (const metadata of ["strip", "keep", undefined]) {
      assert.deepEqual(problemsOf("item.photo", { contentTypes: ["image/*", "image/png", "image/avif", "video/*"], metadata }), [], String(metadata));
    }
  });

  test("strip / keep 以外の値は問題", () => {
    assert.match(problemsOf("item.photo", { contentTypes: ["image/*"], metadata: "remove" })[0], /item\.photo: metadata は "strip" か "keep"/);
  });

  test("strip の用途（省略を含む）に描き直せない画像の型を書くと問題、keep なら通る", () => {
    assert.match(problemsOf("item.photo", { contentTypes: ["image/*", "image/heic"] })[0], /image\/heic/);
    assert.match(problemsOf("item.photo", { contentTypes: ["image/svg+xml"], metadata: "strip" })[0], /image\/svg\+xml/);
    assert.deepEqual(problemsOf("item.photo", { contentTypes: ["image/heic", "image/svg+xml"], metadata: "keep" }), []);
  });

  test("画像の型の無い用途に strip を書くと問題（省略・keep は通る）", () => {
    assert.match(problemsOf("item.video", { contentTypes: ["video/*"], metadata: "strip" })[0], /画像の型が contentTypes に無い/);
    assert.deepEqual(problemsOf("item.video", { contentTypes: ["video/*"] }), []);
    assert.deepEqual(problemsOf("item.video", { contentTypes: ["video/*"], metadata: "keep" }), []);
  });

  test("user.avatar を keep にすると問題（D29）", () => {
    assert.match(problemsOf("user.avatar", { contentTypes: ["image/*"], metadata: "keep" })[0], /user\.avatar: この用途は keep にできません/);
    assert.deepEqual(problemsOf("user.avatar", { contentTypes: ["image/*"], metadata: "strip" }), []);
  });
});

const ROLE_CATEGORIES = new Map([
  ["admin", "admin"],
  ["editor", "admin"],
  ["user", "user"],
  ["contributor", "user"],
]);

function mediaField(overrides = {}) {
  return {
    name: "photo",
    fieldType: "mediaUploader",
    mediaTypePreset: "images",
    accept: "image/*",
    validationRule: { maxSizeBytes: 1000 },
    ...overrides,
  };
}

function build(apiAccess, field = mediaField()) {
  return buildStoragePurposeEntries({
    camel: "item",
    config: { apiAccess, fields: [field, { name: "title", fieldType: "string" }] },
    roleCategories: ROLE_CATEGORIES,
  });
}

const ADMIN = { roleCategories: ["admin"] };

describe("生成器の導出", () => {
  test("create だけ・update だけが一般利用者でも、visibility が無ければ生成エラー", () => {
    for (const operations of [
      { create: "authenticated" },
      { update: { roleCategories: ["user"] } },
      { update: { roles: ["contributor"] } },
    ]) {
      const { entries, errors } = build({ read: "public", write: ADMIN, operations });
      assert.equal(entries.length, 0, JSON.stringify(operations));
      assert.match(errors[0], /item\.photo.*storage\.visibility/, JSON.stringify(operations));
    }
  });

  test("visibility を明示すれば一般利用者の項目も生成され、upload は create と update の和", () => {
    const { entries, errors } = build(
      { read: "public", write: ADMIN, operations: { update: "authenticated" } },
      mediaField({ storage: { visibility: "public" } }),
    );
    assert.deepEqual(errors, []);
    assert.equal(
      entries[0].value,
      '{ visibility: "public", maxBytes: 1000, contentTypes: ["image/*"], metadata: "strip", upload: { allow: "authenticated" } }',
    );
  });

  test("管理者だけが上げる項目は get から visibility を決め、private には read を付ける", () => {
    const pub = build({ read: "public", write: ADMIN });
    assert.match(pub.entries[0].value, /visibility: "public"/);
    assert.doesNotMatch(pub.entries[0].value, /read:/);

    const priv = build({ read: { roles: ["editor"] }, write: { roles: ["editor"], roleCategories: ["admin"] } });
    assert.deepEqual(priv.errors, []);
    assert.equal(
      priv.entries[0].value,
      '{ visibility: "private", maxBytes: 1000, contentTypes: ["image/*"], metadata: "strip", upload: { allow: { roles: ["editor"], roleCategories: ["admin"] } }, read: { allow: { roles: ["editor"] } } }',
    );

    // apiAccess 未宣言は管理者のみ・private（fail-closed）
    const none = build(undefined);
    assert.match(none.entries[0].value, /visibility: "private".*upload: \{ allow: \{ roleCategories: \["admin"\] \} \}/);
  });

  test("maxSizeBytes が無ければ既定値の式と、項目名・採用値の警告", () => {
    const { entries, warnings } = build({ read: "public", write: ADMIN }, mediaField({ validationRule: {}, mediaTypePreset: "videos" }));
    assert.match(entries[0].value, /maxBytes: STORAGE_CONFIG\.defaultMaxBytesByPreset\.videos/);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /item\.photo.*defaultMaxBytesByPreset\.videos/);
  });

  test("不正な storage 指定・空の accept はエラー", () => {
    assert.match(build({}, mediaField({ storage: { upload: "public" } })).errors[0], /storage\.upload/);
    assert.match(build({}, mediaField({ storage: { visibility: "secret" } })).errors[0], /storage\.visibility/);
    assert.match(build({}, mediaField({ accept: "" })).errors[0], /accept/);
  });
});

describe("生成器の metadata", () => {
  const PUBLIC_ADMIN = { read: "public", write: ADMIN };
  const valueOf = (field) => {
    const { entries, errors } = build(PUBLIC_ADMIN, mediaField(field));
    assert.deepEqual(errors, []);
    return entries[0].value;
  };

  test("画像を含む項目は省略でも metadata: \"strip\" を明示値で書き出し、keep はそのまま書き出す", () => {
    assert.match(valueOf({}), /contentTypes: \["image\/\*"\], metadata: "strip", upload:/);
    assert.match(valueOf({ accept: "image/*,video/*" }), /metadata: "strip"/);
    assert.match(valueOf({ storage: { metadata: "strip" } }), /metadata: "strip"/);
    assert.match(valueOf({ accept: "image/heic,image/png", storage: { metadata: "keep" } }), /metadata: "keep"/);
  });

  test("画像の型の無い項目には書き出さない（keep を書いても出さない）", () => {
    assert.doesNotMatch(valueOf({ accept: "video/*" }), /metadata/);
    assert.doesNotMatch(valueOf({ accept: "application/pdf", storage: { metadata: "keep" } }), /metadata/);
  });

  test("contentTypes は accept のまま（image/* を読み替えない）", () => {
    assert.match(valueOf({ accept: "image/*, image/png" }), /contentTypes: \["image\/\*", "image\/png"\]/);
  });

  test("strip / keep 以外の値はエラー", () => {
    assert.match(build(PUBLIC_ADMIN, mediaField({ storage: { metadata: "remove" } })).errors[0], /item\.photo: storage\.metadata は "strip" か "keep"/);
  });

  test("strip（省略を含む）で描き直せない画像の型を accept に書くとエラー", () => {
    assert.match(build(PUBLIC_ADMIN, mediaField({ accept: "image/*,image/heic" })).errors[0], /item\.photo:.*image\/heic/);
    assert.match(
      build(PUBLIC_ADMIN, mediaField({ accept: "image/svg+xml", storage: { metadata: "strip" } })).errors[0],
      /image\/svg\+xml/,
    );
  });

  test("画像の型の無い項目に strip を明示するとエラー", () => {
    assert.match(
      build(PUBLIC_ADMIN, mediaField({ accept: "video/*", storage: { metadata: "strip" } })).errors[0],
      /item\.photo: 画像の型が accept に無い/,
    );
  });

  test("生成した値は登録表の検査も通る", () => {
    // 生成器と listStoragePurposeProblems の規則が食い違っていないこと（値の文字列を評価して確かめる）
    for (const field of [{}, { accept: "image/png,video/*" }, { accept: "image/heic", storage: { metadata: "keep" } }, { accept: "video/*" }]) {
      const purpose = new Function(`return (${valueOf(field)});`)();
      assert.deepEqual(listStoragePurposeProblems({ "item.photo": purpose }), [], JSON.stringify(field));
    }
  });
});

const REGISTRY_FIXTURE = `import "server-only";

import type { StoragePurposeMap } from "@/lib/storage";

import { CORE_STORAGE_PURPOSES } from "./storagePurposes/core";

export const storagePurposeRegistry = {
  ...CORE_STORAGE_PURPOSES,
  // --- AUTO-GENERATED-START ---
  "item.old_field": { visibility: "public", maxBytes: 1, contentTypes: ["image/*"], upload: { allow: "authenticated" } },
  "other.photo": { visibility: "public", maxBytes: 1, contentTypes: ["image/*"], upload: { allow: "authenticated" } },
  // --- AUTO-GENERATED-END ---
  // --- FORK (手書き) ---
  "item.cover": { visibility: "private", maxBytes: 5, contentTypes: ["image/png"], upload: { allow: "authenticated" }, read: { allow: "authenticated" } },
} satisfies StoragePurposeMap;
`;

const ENTRIES = [
  { id: "item.photo", value: '{ visibility: "public", maxBytes: STORAGE_CONFIG.defaultMaxBytesByPreset.images, contentTypes: ["image/*"], upload: { allow: "authenticated" } }' },
  { id: "item.cover", value: '{ visibility: "public", maxBytes: 1, contentTypes: ["image/*"], upload: { allow: "authenticated" } }' },
];

describe("登録表の書き換え（AUTO ブロックだけ）", () => {
  test("AUTO に追加し、消えた項目を削除し、FORK と他ドメインと CORE は触らない", () => {
    const { text, skipped } = applyStoragePurposeEntries(REGISTRY_FIXTURE, { camel: "item", entries: ENTRIES });
    assert.deepEqual(skipped, ["item.cover"]);
    assert.match(text, /\.\.\.CORE_STORAGE_PURPOSES,/);
    assert.match(text, /"item\.photo": \{ visibility: "public"/);
    assert.doesNotMatch(text, /item\.old_field/);
    assert.match(text, /"other\.photo"/);
    assert.match(text, /"item\.cover": \{ visibility: "private", maxBytes: 5/);
    assert.match(text, /^import \{ STORAGE_CONFIG \} from "@\/config\/app\/storage\.config";$/m);
    // 追加位置は AUTO ブロックの中
    assert.ok(text.indexOf('"item.photo"') < text.indexOf("// --- AUTO-GENERATED-END ---"));

    const again = applyStoragePurposeEntries(text, { camel: "item", entries: ENTRIES });
    assert.equal(again.text, text, "再生成で重複・差分が出ない");
  });

  test("dc:delete は AUTO の <domain>.* だけを消し、不要になった import も外す", () => {
    const { text } = applyStoragePurposeEntries(REGISTRY_FIXTURE, { camel: "item", entries: ENTRIES });
    const removed = removeStoragePurposeEntries(text, { camel: "item" });
    assert.doesNotMatch(removed, /"item\.photo"/);
    assert.match(removed, /"item\.cover"/);
    assert.match(removed, /"other\.photo"/);
    assert.doesNotMatch(removed, /STORAGE_CONFIG/);
    assert.equal(syncStorageConfigImport(removed), removed);
  });

  test("実際の登録表の AUTO ブロックは sample の domain.json から再生成しても変わらない", () => {
    const registryText = fs.readFileSync(path.join(rootDir, "src", "registry", "storagePurposeRegistry.ts"), "utf8");
    const config = JSON.parse(fs.readFileSync(path.join(rootDir, "src", "features", "sample", "domain.json"), "utf8"));
    const { entries, errors } = buildStoragePurposeEntries({ camel: "sample", config, roleCategories: ROLE_CATEGORIES });
    assert.deepEqual(errors, []);
    assert.equal(applyStoragePurposeEntries(registryText, { camel: "sample", entries }).text, registryText);
  });
});

describe("メディア列と systemColumns（特権書き込み）・hiddenColumns", () => {
  test("storage オプションの列を systemColumns に入れると、サービスを作る時点で throw", async () => {
    const { pgTable, text, uuid } = await import("drizzle-orm/pg-core");
    const { createCrudService } = await import("../../src/lib/crud/drizzle/service.ts");
    const table = pgTable("check_storage_system_columns", { id: uuid("id").primaryKey(), photo: text("photo"), note: text("note") });
    const binding = {
      fields: [{ name: "photo", purpose: "item.photo" }],
      afterWrite: async () => null,
      afterHardDelete: async () => null,
      duplicateValues: async () => ({}),
      afterCommit: async () => {},
    };
    assert.throws(
      () => createCrudService(table, { storage: binding, systemColumns: ["photo"] }),
      /media column\(s\) "photo"/,
    );
    assert.doesNotThrow(() => createCrudService(table, { storage: binding, systemColumns: ["note"] }));
  });

  test("storage オプションの列を hiddenColumns にすると、サービスを作る時点で throw（掃除の照合が値を読めないため）", async () => {
    const { pgTable, text, uuid } = await import("drizzle-orm/pg-core");
    const { createCrudService } = await import("../../src/lib/crud/drizzle/service.ts");
    const { defineHiddenColumns } = await import("../../src/lib/crud/drizzle/hiddenColumns.ts");
    const binding = {
      fields: [{ name: "photo", purpose: "item.photo" }],
      afterWrite: async () => null,
      afterHardDelete: async () => null,
      duplicateValues: async () => ({}),
      afterCommit: async () => {},
    };
    const hiddenMedia = pgTable("check_storage_hidden_media", { id: uuid("id").primaryKey(), photo: text("photo"), secret: text("secret") });
    defineHiddenColumns(hiddenMedia, ["photo"]);
    assert.throws(() => createCrudService(hiddenMedia, { storage: binding }), /hiddenColumns: media column\(s\) "photo"/);
    const hiddenOther = pgTable("check_storage_hidden_other", { id: uuid("id").primaryKey(), photo: text("photo"), secret: text("secret") });
    defineHiddenColumns(hiddenOther, ["secret"]);
    assert.doesNotThrow(() => createCrudService(hiddenOther, { storage: binding }));
  });

  test("serviceRegistry に登録された全サービスが作れる（違反があれば読み込みで throw する）", async () => {
    const { serviceRegistry } = await import("../../src/registry/serviceRegistry.ts");
    assert.ok(Object.keys(serviceRegistry).length > 0);
    // サービスは遅延読み込み（domainEntry.ts）なので、1 つずつ読み込んで createCrudService を走らせる
    for (const [key, entry] of Object.entries(serviceRegistry)) {
      assert.equal(typeof (await entry.service()), "object", `${key}: service がオブジェクトを返さない`);
    }
  });
});
