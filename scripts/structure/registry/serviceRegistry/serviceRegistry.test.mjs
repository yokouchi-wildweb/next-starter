// serviceRegistry（登録名からサービス・表・主キーを引く登録表）の生成・検査と、登録された行の契約のテスト。
// 実行: pnpm test scripts/structure/registry/serviceRegistry/serviceRegistry.test.mjs (node:test + tsx。登録表と各サービスを実際に読み込むため tsx ランナーを使う)
//
// 守りたい契約(設計: src/lib/domain/README.md):
// 1. src/registry/serviceRegistry.ts は登録の宣言(entities/<登録名>/entity.json と fork の entity.override.ts)からの生成結果と一致し、再生成しても変わらない（pnpm check registry と同じ）
// 2. 静的検査: 手書きの登録表(生成物の印の無いファイル)・登録名の重なり・サービスのファイルが無い・base があるのに登録が無い・表の重なりと物理名の形・record_type・
//    上書きの形と静的 import の決まり(型はどこからでも、値は値だけのファイルからだけ、推移的)に合わない import を検出する
// 3. 登録された全エントリは service() でオブジェクトを返し、Drizzle 版は getTableName / getIdColumnName を持つ。
//    登録の table / idColumn（D57）は実物と一致し、null は表を持たない Firestore 版だけ。静的な形と 1 テーブル 1 登録（D58）は pnpm check registry
// 4. 管理データ操作（truncateAll / export / import）は operations に明示したときだけ開く（未指定 = none。read/write/既定に落ちない）
// 5. core 7 キー（auditLog・auditLogFailed・bankTransferReview・pairedDevice・userLineProfile・userLoginEvent・userXProfile）は
//    登録されているが、全件削除の一覧・データ移行・汎用 API（/api/<key>）のどれにも出ない
// 6. useImportExport: false の core（user・coupon・userTag・referral・referralReward・milestone）は import だけ閉じ、export / truncateAll は管理者
// 5・6 の core の既定値は宣言からの行(discoverRegistrations の access、上書き前)で確かめる。fork が entity.override.ts で access を変えても、このテストは編集せずに通る
import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { GENERATED_HEADER, REGISTRY_FILE, SERVICE_DIR, checkOverrideStaticImports, discoverRegistrations, overrideAttribute, readObjectKeys } from "./discover.mjs";
import { buildServiceRegistry, generateServiceRegistry } from "./generate.mjs";
import { checkServiceRegistry } from "./check.mjs";
import { serviceRegistry } from "../../../../src/registry/serviceRegistry.ts";
import { coreRegistrations, domainConfigMap } from "../../../../src/registry/domainConfigRegistry.ts";
// 閉じた lib は入口のファイル(domainAccess の "."・domain の "." と "./server")を相対で読む
import { ADMIN_ONLY, ADMIN_RULE, DOMAIN_CRUD_OPERATIONS, DOMAIN_DATA_OPERATIONS, INTERNAL_ONLY, PUBLIC_READ } from "../../../../src/lib/domainAccess/index.ts";
import { isGenericApiClosed, resolveAccessRule } from "../../../../src/lib/domain/index.ts";
import { findDomainByTable, getDomainList, getDomainTable, getService, hasService, lookupDomainService } from "../../../../src/lib/domain/server.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

/** 宣言からの登録表の行（fork の entity.override.ts を当てる前の既定値）をキーで引く */
function loadDefaultEntries() {
  const { rows } = discoverRegistrations(repoRoot);
  return Object.fromEntries(rows.map((row) => [row.key, row]));
}

/** 行のサービスのファイル(repo 相対、<file>.ts か <file>/index.ts) */
function serviceFileOf(row) {
  const base = `src/domains/${row.dir}/${SERVICE_DIR}/${row.service.file}`;
  return [`${base}.ts`, `${base}/index.ts`].find((file) => fs.existsSync(path.join(repoRoot, file)));
}

const INTERNAL_KEYS = ["auditLog", "auditLogFailed", "bankTransferReview", "pairedDevice", "userLineProfile", "userLoginEvent", "userXProfile"];
const NO_IMPORT_KEYS = ["user", "coupon", "userTag", "referral", "referralReward", "milestone"];

// ---------------------------------------------------------------------------
// 1. 実リポの登録表
// ---------------------------------------------------------------------------

test("serviceRegistry.ts は登録の宣言からの生成結果と一致する（pnpm check registry）", () => {
  const { errors } = checkServiceRegistry(repoRoot);
  assert.deepEqual(errors, []);
  const text = fs.readFileSync(path.join(repoRoot, REGISTRY_FILE), "utf8");
  assert.equal(text.split("\n")[0], GENERATED_HEADER);
  assert.equal(buildServiceRegistry(repoRoot).text, text, "再生成しても差分 0");
});

test("実リポの entity.override.ts は静的 import の決まりに合う", () => {
  const { rows } = discoverRegistrations(repoRoot);
  assert.ok(rows.length >= 30);
  const memo = new Map();
  for (const row of rows.filter((item) => item.overridePath)) {
    assert.deepEqual(checkOverrideStaticImports(row.overridePath, repoRoot, undefined, memo), [], row.overridePath);
  }
});

test("登録された全エントリは service() でオブジェクトを返し、Drizzle 版は getTableName / getIdColumnName を持つ。登録の table / idColumn は実物と一致し、null は表を持たないサービスだけ", async () => {
  for (const [key, entry] of Object.entries(serviceRegistry)) {
    assert.equal(typeof entry.service, "function", `${key}: service は遅延読み込みの関数`);
    assert.equal(typeof entry.access, "object", `${key}: access は型必須`);
    const service = await entry.service();
    assert.equal(typeof service, "object", `${key}: service() がオブジェクトを返さない`);
    if (typeof service.getTableName === "function") {
      assert.match(service.getTableName(), /^[a-z0-9_]+$/, `${key}: getTableName`);
      assert.equal(service.getIdColumnName(), "id", `${key}: 主キー列の物理名`);
      assert.equal(typeof service.truncateAll, "function");
      assert.equal(typeof service.searchWithDeleted, "function");
      assert.equal(entry.table, service.getTableName(), `${key}: 登録の table が実物の getTableName() と違う`);
      assert.equal(entry.idColumn, service.getIdColumnName(), `${key}: 登録の idColumn が実物の getIdColumnName() と違う`);
    } else {
      assert.equal(key, "chatRoom", "getTableName を持たないのは Firestore 版の chatRoom だけ");
      assert.equal(entry.table, null, `${key}: 表を持たないサービスの table は null`);
      assert.equal(entry.idColumn, null, `${key}: 表を持たないサービスの idColumn は null`);
    }
  }
});

test("登録表の行は宣言のとおり: キーの集合・service は entity.json の service(か既定)の export・table / idColumn / requires、access は上書きの無いキーでは既定値そのもの", async () => {
  const defaults = loadDefaultEntries();
  assert.deepEqual(Object.keys(serviceRegistry).sort(), Object.keys(defaults).sort());
  for (const [key, entry] of Object.entries(serviceRegistry)) {
    const row = defaults[key];
    const file = serviceFileOf(row);
    assert.ok(file, `${key}: サービスのファイルが無い`);
    const mod = await import(path.join(repoRoot, file));
    assert.equal(await entry.service(), mod[row.service.export], `${key}: service は ${file} の ${row.service.export}（上書きでも変わらない）`);
    assert.equal(entry.table, row.table, `${key}: table`);
    assert.equal(entry.idColumn, row.idColumn, `${key}: idColumn`);
    assert.deepEqual(entry.requires ?? [], row.requires, `${key}: requires`);
    if (!row.overridePath) assert.deepEqual(entry.access, row.access, `${key}: 上書きが無いのに access が既定値と違う`);
  }
});

test("core 7 キーは登録されているが、汎用 API・全件削除の一覧・データ移行のどれにも出ない（既定値）", async () => {
  const defaults = await loadDefaultEntries();
  for (const key of INTERNAL_KEYS) {
    assert.ok(hasService(serviceRegistry, key), `${key} が登録表に無い`);
    const { access } = defaults[key];
    assert.deepEqual(access, INTERNAL_ONLY, `${key}: INTERNAL_ONLY で登録する`);
    assert.ok(isGenericApiClosed(access), `${key}: 汎用 CRUD（/api/${key}/**）が閉じていない`);
    for (const operation of DOMAIN_DATA_OPERATIONS) {
      assert.equal(resolveAccessRule(access, operation, "write"), "none", `${key}: ${operation} が閉じていない`);
    }
    // ドメイン名からサービス・表は引ける（これが登録の目的）
    const lookup = await lookupDomainService(serviceRegistry, key, { require: ["searchWithDeleted", "getTableName"] });
    assert.equal(lookup.status, "found", `${key}: ${JSON.stringify(lookup)}`);
  }
  // 全件削除の一覧（truncateAll 対応の全行）には出るが、access の truncateAll が none なのでルートが除く
  const listed = (await getDomainList(serviceRegistry, domainConfigMap, coreRegistrations)).map((domain) => domain.key);
  for (const key of INTERNAL_KEYS) {
    const inList = listed.includes(key);
    assert.ok(inList, `${key}: truncateAll を持つので一覧の候補には出る（ルートが access で除く）`);
    assert.equal(resolveAccessRule(defaults[key].access, "truncateAll", "write"), "none");
  }
  // chatRoom（Firestore）は truncateAll を持たないので候補にも出ない
  assert.ok(!listed.includes("chatRoom"));
});

test("useImportExport: false の core は import だけ閉じ、export / truncateAll は管理者（今までの挙動。既定値）", async () => {
  const defaults = await loadDefaultEntries();
  for (const key of NO_IMPORT_KEYS) {
    const { access } = defaults[key];
    assert.equal(resolveAccessRule(access, "import", "write"), "none", `${key}: import`);
    assert.deepEqual(resolveAccessRule(access, "export", "write"), ADMIN_RULE, `${key}: export`);
    assert.deepEqual(resolveAccessRule(access, "truncateAll", "write"), ADMIN_RULE, `${key}: truncateAll`);
    assert.deepEqual(resolveAccessRule(access, "list", "read"), ADMIN_RULE, `${key}: list`);
  }
  // それ以外の既存 core 行はデータ操作 3 つとも管理者
  // setting の読み書きは専用の窓口だけ。汎用 API は export のほか閉じる
  const setting = defaults.setting.access;
  for (const [operation, kind] of [["get", "read"], ["list", "read"], ["update", "write"], ["create", "write"], ["delete", "write"], ["truncateAll", "write"], ["import", "write"]]) assert.equal(resolveAccessRule(setting, operation, kind), "none", `setting: ${operation}`);
  assert.deepEqual(resolveAccessRule(setting, "export", "write"), ADMIN_RULE);
  for (const key of ["wallet", "walletHistory", "purchaseRequest", "couponHistory", "userCounter", "interactionEvent", "chatRoom", "deviceFingerprint", "fingerprintChallenge", "couponAttributionReward", "couponIssuerGrant"]) {
    for (const operation of DOMAIN_DATA_OPERATIONS) {
      assert.deepEqual(resolveAccessRule(defaults[key].access, operation, "write"), ADMIN_RULE, `${key}: ${operation}`);
    }
  }
  // 業務ドメイン: sample は useImportExport: true、sampleTag は false
  assert.deepEqual(resolveAccessRule(serviceRegistry.sample.access, "import", "write"), ADMIN_RULE);
  assert.equal(resolveAccessRule(serviceRegistry.sampleTag.access, "import", "write"), "none");
  assert.equal(resolveAccessRule(serviceRegistry.sampleTag.access, "export", "write"), "none");
  assert.equal(resolveAccessRule(serviceRegistry.sampleTag.access, "list", "read"), "public");
});

// ---------------------------------------------------------------------------
// 4. resolveAccessRule の契約（管理データ操作は operations だけを見る）
// ---------------------------------------------------------------------------

test("resolveAccessRule: 管理データ操作は operations に無ければ none（read / write / 既定の管理者に落ちない）", () => {
  for (const operation of DOMAIN_DATA_OPERATIONS) {
    assert.equal(resolveAccessRule(ADMIN_ONLY, operation, "write"), "none", `${operation}: ADMIN_ONLY でも閉じる`);
    assert.equal(resolveAccessRule(PUBLIC_READ, operation, "read"), "none");
    assert.equal(resolveAccessRule({}, operation, "write"), "none", `${operation}: 空 {} でも既定の管理者に落ちない`);
    assert.equal(resolveAccessRule({ operations: { [operation]: "bogus" } }, operation, "write"), "none", "不正な値も none");
    assert.deepEqual(resolveAccessRule({ operations: { [operation]: ADMIN_RULE } }, operation, "write"), ADMIN_RULE);
  }
  // CRUD 操作は今までどおり既定（管理者）に落ちる
  assert.deepEqual(resolveAccessRule({}, "list", "read"), { roleCategories: ["admin"] });
  assert.equal(resolveAccessRule(PUBLIC_READ, "list", "read"), "public");
  assert.equal(isGenericApiClosed(INTERNAL_ONLY), true);
  assert.equal(isGenericApiClosed(ADMIN_ONLY), false);
  assert.equal(isGenericApiClosed({ read: "none", write: "none", operations: { get: "public" } }), false);
  assert.equal(DOMAIN_CRUD_OPERATIONS.includes("truncateAll"), false, "truncateAll は汎用ルートの操作ではない");
});

test("getService / lookupDomainService: 未登録・読み込み失敗・操作なしを区別する", async () => {
  const registry = {
    ok: { service: async () => ({ list: async () => [] }), access: ADMIN_ONLY },
    broken: { service: async () => { throw new Error("boom"); }, access: ADMIN_ONLY },
  };
  assert.equal(hasService(registry, "ok"), true);
  assert.equal(hasService(registry, "toString"), false, "prototype のキーは登録扱いにしない");
  assert.equal(await getService(registry, "missing"), undefined);
  assert.deepEqual(await lookupDomainService(registry, "missing"), { status: "unregistered" });
  assert.equal((await lookupDomainService(registry, "broken")).status, "load_failed");
  assert.deepEqual(await lookupDomainService(registry, "ok", { require: ["searchWithDeleted"] }), {
    status: "unsupported",
    missing: ["searchWithDeleted"],
  });
  assert.equal((await lookupDomainService(registry, "ok", { require: ["list"] })).status, "found");
  await assert.rejects(getService(registry, "broken"), /boom/);
});

// ---------------------------------------------------------------------------
// 2. 静的検査（一時リポで）
// ---------------------------------------------------------------------------

const tempRoots = [];
after(() => {
  for (const root of tempRoots) fs.rmSync(root, { recursive: true, force: true });
});

/** 一時の木に必ず写す実物: tsconfig(paths で @/ を解く)と、上書きが値で読む lib/domainAccess(値だけのファイル)と lib/domain の型 */
function baseFiles() {
  const real = (rel) => fs.readFileSync(path.join(repoRoot, rel), "utf8");
  const copyDir = (dir) =>
    Object.fromEntries(fs.readdirSync(path.join(repoRoot, dir)).filter((name) => name.endsWith(".ts")).map((name) => [`${dir}/${name}`, real(`${dir}/${name}`)]));
  return { "tsconfig.json": real("tsconfig.json"), ...copyDir("src/lib/domainAccess"), ...copyDir("src/lib/domain/types") };
}

function makeRoot(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "service-registry-"));
  tempRoots.push(root);
  for (const [rel, content] of Object.entries({ ...baseFiles(), ...files })) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return root;
}

/**
 * 一時の木のドメインの宣言: domain.json と登録ごとの entities/<登録名>/entity.json、既定のサービスのファイル services/server/<登録名>Service.ts。
 * registrations = 登録名 → entity.json の中身。service: false の登録はサービスのファイルを置かない
 */
function declared(folder, registrations = {}, { service = true } = {}) {
  const files = { [`${folder}/domain.json`]: JSON.stringify({ domainConfigVersion: "2.0", label: folder.split("/").at(-1) }) };
  for (const [name, entity] of Object.entries(registrations)) {
    files[`${folder}/entities/${name}/entity.json`] = JSON.stringify(entity);
    if (service) files[`${folder}/${SERVICE_DIR}/${name}Service.ts`] = `export const ${name}Service = {};\n`;
  }
  return files;
}

const OVERRIDE = (imports, value) => `import type { EntityOverride } from "@/lib/domain";
${imports}
export const entityOverride = { apiAccess: ${value} } satisfies EntityOverride;
`;

test("生成: core → 業務の順に並び、上書きは access だけ差し替え、2 回目は変更なし", (t) => {
  t.mock.method(console, "log", () => {});
  const root = makeRoot({
    ...declared("src/domains/core/user", { user: { plural: "users" } }),
    "src/domains/core/user/services/server/userBase.ts": "",
    ...declared("src/domains/core/userTag", { userTag: { plural: "userTags" } }),
    "src/domains/core/userTag/entities/userTag/entity.override.ts": OVERRIDE(`import { PUBLIC_READ } from "@/lib/domainAccess";`, "PUBLIC_READ"),
    ...declared("src/domains/article", { article: { plural: "articles", requires: ["user"] } }),
  });
  const first = generateServiceRegistry(root);
  assert.equal(first.written, true);
  const text = fs.readFileSync(path.join(root, REGISTRY_FILE), "utf8");
  assert.equal(text.split("\n")[0], GENERATED_HEADER);
  assert.match(text, /import \{ entityOverride as userTagOverride \} from "@\/domains\/core\/userTag\/entities\/userTag\/entity\.override";/);
  assert.match(text, /import \{ ADMIN_ONLY, ADMIN_RULE \} from "@\/lib\/domainAccess";/);
  assert.match(
    text,
    /\n {2}user: \{\n {4}service: \(\) => import\("@\/domains\/core\/user\/services\/server\/userService"\)\.then\(\(m\) => m\.userService\),\n {4}table: "users",\n {4}idColumn: "id",\n {4}access: \{\n {6}\.\.\.ADMIN_ONLY,\n/,
  );
  assert.match(text, /\n {2}userTag: \{\n[^}]*table: "user_tags",\n {4}idColumn: "id",\n {4}access: userTagOverride\.apiAccess,\n {2}\},/);
  assert.match(text, /\n {4}requires: \["user"\],\n {2}\},\n\};\n$/, "requires は entity.json から(最後の業務の行)");
  assert.deepEqual(readObjectKeys(text, "serviceRegistry").keys, ["user", "userTag", "article"]);
  const second = generateServiceRegistry(root);
  assert.equal(second.written, false);
  assert.deepEqual(checkServiceRegistry(root).errors, []);
});

test("検査: 生成物の印の無い(手書きの)登録表は失敗し、移し先を出す。印付きなら除去として通す", (t) => {
  t.mock.method(console, "log", () => {});
  const root = makeRoot({
    ...declared("src/domains/core/user", { user: { plural: "users" } }),
    [REGISTRY_FILE]: `import { userService } from "@/domains/user/services/server/userService";
export const serviceRegistry = {
  user: { service: userService, access: ADMIN_ONLY },
  legacy: { service: legacyService, access: ADMIN_ONLY },
};
`,
  });
  const { errors } = checkServiceRegistry(root);
  assert.ok(errors.some((error) => /serviceRegistry\.ts: 生成物の印が無い\(手書きの登録表\)。行は登録の entity\.json に移し\(fork が core の access を変えるなら entity\.override\.ts\)/.test(error)), errors.join("\n"));
  assert.throws(() => generateServiceRegistry(root), /生成物の印が無い/);

  // 生成物の印付きなら、宣言の無いキーは除去として通る
  fs.writeFileSync(path.join(root, REGISTRY_FILE), `${GENERATED_HEADER}\nexport const serviceRegistry = {\n  user: 1,\n  gone: 2,\n};\n`);
  const result = generateServiceRegistry(root);
  assert.deepEqual(result.removed, ["gone"]);
  assert.deepEqual(checkServiceRegistry(root).errors, []);
});

test("override: 空(空白とコメントだけ)の entity.override.ts は不在と同じ(D34 K1)", (t) => {
  t.mock.method(console, "log", () => {});
  const root = makeRoot({
    ...declared("src/domains/core/userTag", { userTag: {} }),
    "src/domains/core/userTag/entities/userTag/entity.override.ts": "// 親の上書きを外した(下の Tier)\n",
  });
  generateServiceRegistry(root);
  const text = fs.readFileSync(path.join(root, REGISTRY_FILE), "utf8");
  assert.doesNotMatch(text, /import \{ entityOverride/);
  assert.doesNotMatch(text, /Override\.apiAccess/);
  assert.deepEqual(checkServiceRegistry(root).errors, []);
});

test("検査: 登録名の重なり・サービスのファイル無し・base があるのに登録が無い・record_type・決まりに合わない import・読めない上書き・registered: false の上書き", () => {
  const root = makeRoot({
    ...declared("src/domains/core/user", { user: {} }),
    ...declared("src/domains/core/dup", { user: { plural: "dups" } }),
    ...declared("src/domains/core/noService", { noService: {} }, { service: false }),
    ...declared("src/domains/core/orphan"),
    "src/domains/core/orphan/services/server/orphanBase.ts": "",
    "src/domains/core/orphan/services/server/photo.ts": 'storageBindingFor("orphanPhoto", [])',
    "src/domains/core/orphan/services/server/photo.test.ts": 'storageBindingFor("ignored", [])',
    ...declared("src/domains/core/leak", { leak: {} }),
    "src/domains/core/leak/entities/leak/entity.override.ts": `import { leakService } from "./leakService";\nexport const entityOverride = { apiAccess: { read: leakService, write: "none" } };\n`,
    ...declared("src/domains/core/broken", { broken: {} }),
    "src/domains/core/broken/entities/broken/entity.override.ts": `export const other = {};\n`,
    ...declared("src/domains/core/hidden", { hidden: { registered: false } }, { service: false }),
    "src/domains/core/hidden/entities/hidden/entity.override.ts": OVERRIDE("", `{ read: "none", write: "none" }`),
    // entity.json も表のファイルも無いフォルダは登録でない(孤立した上書きは pnpm check extensions の orphans.mjs)
    "src/domains/core/user/entities/nope/entity.override.ts": OVERRIDE("", `{ read: "none", write: "none" }`),
    ...declared("src/domains/business"),
    "src/domains/business/services/server/businessBase.ts": "",
  });
  const { errors } = checkServiceRegistry(root);
  const expect = (pattern) => assert.ok(errors.some((error) => pattern.test(error)), `${pattern} が無い:\n${errors.join("\n")}`);
  expect(/登録名 "user" が重なる: src\/domains\/core\/dup\/entities\/user\/entity\.json と src\/domains\/core\/user\/entities\/user\/entity\.json/);
  expect(/core\/noService\/entities\/noService\/entity\.json: サービスのファイル src\/domains\/core\/noService\/services\/server\/noServiceService\.ts が無い/);
  assert.ok(!errors.some((error) => error.includes("hidden/entities/hidden/entity.json: サービスのファイル")), "registered: false の登録はサービスを求めない");
  expect(/src\/domains\/core\/orphan\/services\/server\/orphanBase\.ts の登録\(entities\/orphan\/entity\.json\)が無い/);
  expect(/src\/domains\/business\/services\/server\/businessBase\.ts の登録\(entities\/business\/entity\.json\)が無い/);
  expect(/storageBindingFor\("orphanPhoto"\) の record_type が登録表のキーに無い/);
  assert.ok(!errors.some((error) => error.includes('"ignored"')), "*.test.* は走査しない");
  expect(/leak\/entities\/leak\/entity\.override\.ts: "\.\/leakService" を値で import している\(解けない指定子/);
  expect(/broken\/entities\/broken\/entity\.override\.ts: export const entityOverride が無い/);
  expect(/hidden\/entities\/hidden\/entity\.override\.ts: 登録が registered: false なので上書きする登録表の行が無い/);
  assert.ok(!errors.some((error) => error.includes("entities/nope")), "登録でないフォルダの上書きは登録表の検査に載らない");
  expect(/serviceRegistry.ts が無い → pnpm generate registry/);
});

test("検査: 登録名の重なりは別々のドメインの間でも止め、両方の entity.json を名指す(業務と core)", () => {
  const root = makeRoot({
    ...declared("src/domains/core/catalog", { item: { plural: "catalogItems" } }),
    ...declared("src/domains/shop", { item: { plural: "shopItems" } }),
  });
  const { errors } = discoverRegistrations(root);
  const collisions = errors.filter((error) => error.startsWith('登録名 "item" が重なる: '));
  assert.equal(collisions.length, 1, errors.join("\n"));
  assert.ok(collisions[0].includes("src/domains/core/catalog/entities/item/entity.json"), collisions[0]);
  assert.ok(collisions[0].includes("src/domains/shop/entities/item/entity.json"), collisions[0]);
  // 登録名は registered: false の登録とも同じ名前の空間
  const hidden = makeRoot({
    ...declared("src/domains/core/catalog", { item: { registered: false } }, { service: false }),
    ...declared("src/domains/shop", { item: {} }),
  });
  assert.ok(discoverRegistrations(hidden).errors.some((error) => error.startsWith('登録名 "item" が重なる: ')), "registered: false とも重なる");
});

test("表と主キー: entity.json の table か snake(plural)、主キー 1 列は列の物理名、形違いと同じ表の 2 登録は失敗、Firestore は null / null", () => {
  const long = "a".repeat(64);
  const root = makeRoot({
    ...declared("src/domains/core/empty", { empty: { table: "" } }),
    ...declared("src/domains/core/tooLong", { tooLong: { table: long } }),
    ...declared("src/domains/core/spaced", { spaced: { table: "spaced items" } }),
    ...declared("src/domains/core/first", { first: { table: "shared_items" } }),
    ...declared("src/domains/core/second", { second: { plural: "sharedItems" } }),
    ...declared("src/domains/core/realtime", { realtime: { dbEngine: "Firestore", plural: "rooms" } }),
    ...declared("src/domains/core/mixedCase", { mixedCase: { table: "MixedItems" } }),
    ...declared("src/domains/core/visitLog", {
      visitLog: { plural: "visitLogs", primaryKey: { columns: ["code"] }, fields: [{ name: "code", column: { name: "visit_code" } }] },
      visitTag: { primaryKey: { columns: ["visitId", "tagId"] } },
      visitNote: { primaryKey: { columns: ["noteKey"] } },
    }),
  });
  const { rows, errors } = discoverRegistrations(root);
  const expect = (pattern) => assert.ok(errors.some((error) => pattern.test(error)), `${pattern} が無い:\n${errors.join("\n")}`);
  expect(/core\/empty\/entities\/empty\/entity\.json: 表の物理名 "" が形でない/);
  expect(/core\/tooLong\/entities\/tooLong\/entity\.json: 表の物理名 "a{64}" が形でない/);
  expect(/core\/spaced\/entities\/spaced\/entity\.json: 表の物理名 "spaced items" が形でない/);
  expect(/表 "shared_items" が 2 つの登録にある: src\/domains\/core\/first\/entities\/first\/entity\.json と src\/domains\/core\/second\/entities\/second\/entity\.json/);
  assert.ok(!errors.some((error) => error.includes("realtime")), "Firestore 版（null / null）は通る");
  assert.ok(!errors.some((error) => error.includes("mixedCase")), "大文字を含む名前も形としては通る（正しさは実物との一致で見る）");
  const byKey = Object.fromEntries(rows.map((row) => [row.key, row]));
  assert.deepEqual([byKey.realtime.table, byKey.realtime.idColumn], [null, null]);
  assert.deepEqual([byKey.visitLog.table, byKey.visitLog.idColumn], ["visit_logs", "visit_code"], "主キー 1 列は宣言の列の物理名");
  assert.deepEqual([byKey.visitTag.table, byKey.visitTag.idColumn], ["visit_tag", "id"], "plural が無ければ登録名の snake、複合主キーは id");
  assert.equal(byKey.visitNote.idColumn, "note_key", "列の物理名を書かない主キーは snake");
});

test("access と service: 生成する登録は既定 + apiAccess.operations、generate: false は apiAccess そのまま、service は entity.json の service か既定、registered: false は行に出ない", (t) => {
  t.mock.method(console, "log", () => {});
  const visitAccess = { read: "public", write: "none" };
  const root = makeRoot({
    ...declared("src/domains/visit", { visit: { plural: "visitRows", generate: false, apiAccess: visitAccess, service: { file: "visitStore", export: "visitStore" } } }, { service: false }),
    "src/domains/visit/services/server/visitStore.ts": "export const visitStore = {};\n",
    ...declared("src/domains/core/audit", { audit: { generate: false, service: { file: "index", export: "auditService" } } }, { service: false }),
    "src/domains/core/audit/services/server/index.ts": "export const auditService = {};\n",
    ...declared("src/domains/order", {
      order: { plural: "orders", useImportExport: true },
      orderLine: { useImportExport: true, apiAccess: { read: "public", write: { roleCategories: ["admin"] }, operations: { export: "none" } } },
      orderCache: { registered: false },
    }),
  });
  const { rows, errors } = discoverRegistrations(root);
  assert.deepEqual(errors, []);
  const byKey = Object.fromEntries(rows.map((row) => [row.key, row]));
  assert.deepEqual(Object.keys(byKey).sort(), ["audit", "order", "orderLine", "visit"], "registered: false の登録は行に出ない");
  assert.deepEqual(byKey.visit.access, visitAccess, "generate: false は apiAccess をそのまま(生成の既定を重ねない)");
  assert.deepEqual(byKey.audit.access, { ...ADMIN_ONLY, operations: { truncateAll: ADMIN_RULE, export: "none", import: "none" } }, "apiAccess の無い generate: false は fail-closed の既定");
  assert.deepEqual(byKey.order.access, { ...ADMIN_ONLY, operations: { truncateAll: ADMIN_RULE, export: ADMIN_RULE, import: ADMIN_RULE } }, "useImportExport: true は export / import も管理者");
  assert.deepEqual(byKey.orderLine.access, { ...PUBLIC_READ, operations: { truncateAll: ADMIN_RULE, export: "none", import: ADMIN_RULE } }, "apiAccess.operations の書いた鍵が勝つ(useImportExport の export より)");

  generateServiceRegistry(root);
  const text = fs.readFileSync(path.join(root, REGISTRY_FILE), "utf8");
  assert.match(text, /service: \(\) => import\("@\/domains\/visit\/services\/server\/visitStore"\)\.then\(\(m\) => m\.visitStore\),\n {4}table: "visit_rows",/);
  assert.match(text, /service: \(\) => import\("@\/domains\/core\/audit\/services\/server"\)\.then\(\(m\) => m\.auditService\),/, "service の file が index なら services/server を指す");
  assert.match(text, /\n {2}visit: \{\n[^}]*access: \{\n {6}read: "public",\n {6}write: "none",\n {4}\},/);
  assert.doesNotMatch(text, /orderCache/);
  assert.deepEqual(checkServiceRegistry(root).errors, []);
});

// ---------------------------------------------------------------------------
// 静的 import の決まり(D63・L1.23): 型はどこからでも、値は値だけのファイルからだけ(中身で判定、推移的)
// ---------------------------------------------------------------------------

const OVERRIDE_PATH = "src/domains/shop/entities/shop/entity.override.ts";

/** 一時の木(makeRoot)に上書き 1 本と相手のファイルを置く */
function makeImportRoot(overrideImports, files = {}) {
  return makeRoot({ ...files, [OVERRIDE_PATH]: OVERRIDE(overrideImports, `{ read: "public", write: "none" }`) });
}

test("静的 import の決まり: 通る例(lib/domainAccess の定型・fork の constants/ の定型・型だけの import・推移と循環)", () => {
  const cases = {
    "lib/domainAccess の定型": `import { ADMIN_ONLY, ADMIN_RULE } from "@/lib/domainAccess";`,
    "lib/domainAccess の値の import(型だけのファイルの再 export)": `import { DOMAIN_DATA_OPERATIONS } from "@/lib/domainAccess";
`,
    "fork の constants/ の定型(spread・参照・as const・satisfies)": `import { STAFF_ONLY } from "@/domains/shop/constants/access";`,
    "相対の値の import": `import { STAFF_ONLY } from "../../constants/access";`,
    "型だけの import はどこからでも(services・drizzle・パッケージ)": [
      `import type { ShopService } from "@/domains/shop/services/server/shopService";`,
      `import { type ShopTable } from "@/domains/shop/entities/drizzle";`,
      `import type { NextRequest } from "next/server";`,
    ].join("\n"),
    "値だけのファイルが値だけのファイルを読む(推移)・循環しても止まる": `import { CHAIN } from "@/domains/shop/constants/chain";`,
  };
  const files = {
    "src/domains/shop/constants/access.ts": `import type { DomainApiAccessConfig } from "@/lib/domainAccess";
import { ADMIN_RULE } from "@/lib/domainAccess";

/** 店舗の関係者だけ */
const STAFF_RULE = { roles: ["staff"], roleCategories: ["admin"] } as const;
export const STAFF_ONLY = { read: { ...STAFF_RULE }, write: ADMIN_RULE, list: [STAFF_RULE, ...[1, -2, \`x\`]], none: null, flag: true } satisfies DomainApiAccessConfig;
export type StaffRule = typeof STAFF_RULE;
export interface Staff { id: string }
export { STAFF_RULE };
export default STAFF_ONLY;
`,
    "src/domains/shop/constants/chain.ts": `import { LOOP } from "./loop";\nimport { STAFF_ONLY } from "./access";\nexport const CHAIN = { ...STAFF_ONLY, loop: LOOP.a };\n`,
    // chain → loop → chain の循環
    "src/domains/shop/constants/loop.ts": `import { CHAIN } from "./chain";\nexport const LOOP = { a: 1 };\nexport const BACK = CHAIN;\n`,
  };
  for (const [name, imports] of Object.entries(cases)) {
    const root = makeImportRoot(imports, files);
    assert.deepEqual(checkOverrideStaticImports(OVERRIDE_PATH, root), [], name);
  }
});

test("静的 import の決まり: 落ちる例(services・drizzle・entities の値・副作用の import・関数や呼び出し・推移の先・解けない指定子)", () => {
  const SERVICE = "@/domains/shop/services/server/shopService";
  const cases = [
    ["services の値", `import { shopService } from "${SERVICE}";`, { "src/domains/shop/services/server/shopService.ts": `import { createCrudService } from "@/lib/crud/server";\nexport const shopService = createCrudService({});\n` }, /"@\/domains\/shop\/services\/server\/shopService" → .*shopService\.ts: const shopService が 値の式でない/],
    ["drizzle の値", `import { ShopTable } from "@/domains/shop/entities/drizzle";`, { "src/domains/shop/entities/drizzle.ts": `import { pgTable } from "drizzle-orm/pg-core";\nexport const ShopTable = pgTable("shops", {});\n` }, /"drizzle-orm\/pg-core" を値で import している\(解けない指定子/],
    ["entities の関数", `import { toShop } from "@/domains/shop/entities/model";`, { "src/domains/shop/entities/model.ts": `export function toShop() { return 1; }\n` }, /model\.ts: 値だけのファイルに置けない文がある\(関数/],
    ["副作用の import", `import "@/domains/shop/constants/access";`, { "src/domains/shop/constants/access.ts": `export const A = 1;\n` }, /"@\/domains\/shop\/constants\/access" を副作用の import している/],
    ["呼び出しを持つ定数", `import { A } from "@/domains/shop/constants/access";`, { "src/domains/shop/constants/access.ts": `export const A = Object.freeze({ a: 1 });\n` }, /const A が 値の式でない/],
    ["new", `import { A } from "@/domains/shop/constants/access";`, { "src/domains/shop/constants/access.ts": `export const A = new Set([1]);\n` }, /const A が 値の式でない/],
    ["アロー関数のキー", `import { A } from "@/domains/shop/constants/access";`, { "src/domains/shop/constants/access.ts": `export const A = { f: () => 1 };\n` }, /const A が 値の式でない/],
    ["メソッドのキー", `import { A } from "@/domains/shop/constants/access";`, { "src/domains/shop/constants/access.ts": `export const A = { f() { return 1; } };\n` }, /関数・getter のキー/],
    ["let", `import { A } from "@/domains/shop/constants/access";`, { "src/domains/shop/constants/access.ts": `export let A = 1;\n` }, /let \/ var \/ declare/],
    ["enum", `import { A } from "@/domains/shop/constants/access";`, { "src/domains/shop/constants/access.ts": `export enum A { x }\n` }, /値だけのファイルに置けない文/],
    ["知らない名前の参照(process)", `import { A } from "@/domains/shop/constants/access";`, { "src/domains/shop/constants/access.ts": `export const A = { env: process.env.X };\n` }, /名前 process/],
    ["推移の先が値でない", `import { A } from "@/domains/shop/constants/access";`, { "src/domains/shop/constants/access.ts": `import { B } from "./b";\nexport const A = { b: B };\n`, "src/domains/shop/constants/b.ts": `export const B = Math.max(1, 2);\n` }, /"\.\/b" → src\/domains\/shop\/constants\/b\.ts: const B が 値の式でない/],
    ["値の再 export の先が値でない", `import { A } from "@/domains/shop/constants/access";`, { "src/domains/shop/constants/access.ts": `export { B as A } from "./b";\n`, "src/domains/shop/constants/b.ts": `export const B = Date.now();\n` }, /b\.ts: const B が 値の式でない/],
    ["無いファイル", `import { A } from "@/domains/shop/constants/missing";`, {}, /"@\/domains\/shop\/constants\/missing" を値で import している\(解けない指定子/],
    ["パッケージの値", `import { z } from "zod";`, {}, /"zod" を値で import している\(解けない指定子/],
  ];
  for (const [name, imports, files, pattern] of cases) {
    const errors = checkOverrideStaticImports(OVERRIDE_PATH, makeImportRoot(imports, files));
    assert.ok(errors.length > 0 && errors.every((error) => error.startsWith(`${OVERRIDE_PATH}: `)), `${name}: ${errors.join("\n")}`);
    assert.ok(errors.some((error) => pattern.test(error)), `${name}: ${pattern} が無い:\n${errors.join("\n")}`);
  }
});

test("静的 import の決まり: 登録の上書きは pnpm check registry が同じ決まりで見る", () => {
  const root = makeRoot({
    ...declared("src/domains/shop", { shop: {} }, { service: false }),
    "src/domains/shop/services/server/shopService.ts": `export const shopService = createThing();\n`,
    [OVERRIDE_PATH]: OVERRIDE(`import { shopService } from "@/domains/shop/services/server/shopService";`, `{ read: "public", write: "none" }`),
  });
  const { errors } = discoverRegistrations(root);
  assert.ok(errors.some((error) => /entities\/shop\/entity\.override\.ts: "@\/domains\/shop\/services\/server\/shopService" → .*const shopService が 値の式でない/.test(error)), errors.join("\n"));
});

// ---------------------------------------------------------------------------
// 表 ↔ 登録（D58）と、サービスを読み込まない全件削除の一覧
// ---------------------------------------------------------------------------

test("findDomainByTable / getDomainTable: 実リポの登録表で、表を持つ全キーが表名から自分のキーに戻る", () => {
  let withTable = 0;
  for (const [key, entry] of Object.entries(serviceRegistry)) {
    if (entry.table === null) {
      assert.equal(getDomainTable(serviceRegistry, key), null, `${key}: 表を持たないキーは null`);
      continue;
    }
    withTable += 1;
    assert.equal(findDomainByTable(serviceRegistry, entry.table), key, `${key}: ${entry.table} から引けない`);
    assert.deepEqual(getDomainTable(serviceRegistry, key), { table: entry.table, idColumn: entry.idColumn });
  }
  assert.ok(withTable >= 29);
  assert.equal(getDomainTable(serviceRegistry, "chatRoom"), null, "Firestore 版は表を持たない");
  for (const table of ["user_to_user_tag", "cron_checkpoints", "storage_objects", "no_such_table"]) {
    assert.equal(findDomainByTable(serviceRegistry, table), null, `${table}: 登録の無い表は null`);
  }
  assert.equal(getDomainTable(serviceRegistry, "noSuchDomain"), null);
  assert.equal(getDomainTable(serviceRegistry, "toString"), null, "Object の継承プロパティをキーと取り違えない");
});

test("findDomainByTable: 同じ表が 2 つのキーにある登録表では throw する（黙って片方を返さない）", () => {
  const service = async () => ({});
  const registry = {
    first: { service, access: ADMIN_ONLY, table: "shared_items", idColumn: "id" },
    second: { service, access: ADMIN_ONLY, table: "shared_items", idColumn: "id" },
  };
  assert.throws(() => findDomainByTable(registry, "shared_items"), /表 "shared_items" が登録表の 2 つのキー（"first" と "second"）にある/);
});

test("getDomainList: サービスを読み込まずに登録表の table で一覧を作る（table null は出ない）", async () => {
  let loads = 0;
  const service = async () => {
    loads += 1;
    throw new Error("読み込まれてはいけない");
  };
  const registry = {
    article: { service, access: ADMIN_ONLY, table: "articles", idColumn: "id" },
    room: { service, access: ADMIN_ONLY, table: null, idColumn: null },
    auditTrail: { service, access: ADMIN_ONLY, table: "audit_trails", idColumn: "id" },
  };
  // core = 宣言の置き場(coreKeys)。設定の表にあっても core、無くても core でない物は core でない
  const list = await getDomainList(registry, { article: { label: "記事" }, audit_trail: { label: "監査" } }, ["auditTrail"]);
  assert.equal(loads, 0);
  assert.deepEqual(list, [
    { key: "auditTrail", label: "監査", tableName: "audit_trails", isCore: true },
    { key: "article", label: "記事", tableName: "articles", isCore: false },
  ]);

  // 実リポ: 表を持つ全キー（= Drizzle 版）が一覧に出る
  const real = (await getDomainList(serviceRegistry, domainConfigMap, coreRegistrations)).map((domain) => domain.key).sort();
  const expected = Object.entries(serviceRegistry).filter(([, entry]) => entry.table !== null).map(([key]) => key).sort();
  assert.deepEqual(real, expected);
});

test("getDomainList: 実リポの core の印は宣言の置き場どおり(core の複数登録のドメインの登録も core、業務のドメインは core でない)", async () => {
  const list = await getDomainList(serviceRegistry, domainConfigMap, coreRegistrations);
  const flag = Object.fromEntries(list.map((domain) => [domain.key, domain.isCore]));
  // auditLog は core の auditLog ドメインの主、auditLogFailed は同じドメインの主でない登録
  assert.equal(flag.auditLog, true);
  assert.equal(flag.auditLogFailed, true);
  // sampleImage は業務のドメイン sample の中の集まりの従属の登録(D348)
  assert.equal(flag.sample, false);
  assert.equal(flag.sampleImage, false);
  assert.deepEqual(list.filter((domain) => domain.isCore).map((domain) => domain.key), [...list.filter((domain) => domain.isCore).map((domain) => domain.key)].sort((a, b) => a.localeCompare(b)), "core が先、キーの順");
});

test("上書きが差し替える鍵は宣言 src/lib/domain/extensionPoints.ts の entities から(今は apiAccess だけ)", () => {
  assert.equal(overrideAttribute(), "apiAccess");
});
