// serviceRegistry（ドメイン名からサービス・表・主キーを引く登録表）の生成・検査と、登録された行の契約のテスト。
// 実行: pnpm test:service-registry (node:test + tsx。登録表と各 domainEntry.ts を実際に読み込むため tsx ランナーを使う)
//
// 守りたい契約(設計: src/lib/domain/README.md):
// 1. src/registry/serviceRegistry.ts は domainEntry.ts からの生成結果と一致し、再生成しても変わらない（pnpm registry:check と同じ）
// 2. 静的検査: 手書き行（生成ヘッダの無い旧ファイル）・キーの重複・base があるのに domainEntry.ts が無い・record_type・許可外の import を検出する
// 3. 登録された全エントリは service() でオブジェクトを返し、Drizzle 版は getTableName / getIdColumnName を持つ
// 4. 管理データ操作（truncateAll / export / import）は operations に明示したときだけ開く（未指定 = none。read/write/既定に落ちない）
// 5. core 7 キー（auditLog・auditLogFailed・bankTransferReview・pairedDevice・userLineProfile・userLoginEvent・userXProfile）は
//    登録されているが、全件削除の一覧・データ移行・汎用 API（/api/<key>）のどれにも出ない
// 6. useImportExport: false の core（user・coupon・userTag・referral・referralReward・milestone）は import だけ閉じ、export / truncateAll は管理者
import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { GENERATED_HEADER, REGISTRY_FILE, discoverDomainEntries, listStaticImports, readObjectKeys } from "./discover.mjs";
import { buildServiceRegistry, generateServiceRegistry } from "./generate.mjs";
import { checkServiceRegistry } from "./check.mjs";
import { serviceRegistry } from "../../../src/registry/serviceRegistry.ts";
import { domainConfigMap } from "../../../src/registry/domainConfigRegistry.ts";
import { DOMAIN_CRUD_OPERATIONS, DOMAIN_DATA_OPERATIONS } from "../../../src/lib/domain/types/apiAccess.ts";
import { isGenericApiClosed, resolveAccessRule } from "../../../src/lib/domain/config/apiAccess.ts";
import { ADMIN_ONLY, ADMIN_RULE, INTERNAL_ONLY, PUBLIC_READ } from "../../../src/config/app/domain-api-access.config.ts";
// `export *` だけの index.ts は tsx の ESM 読み込みで名前を拾えないので、実装ファイルを直接読む
import { getDomainList } from "../../../src/lib/domain/service/server/getDomainList.ts";
import { getService, hasService, lookupDomainService } from "../../../src/lib/domain/service/server/getService.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const INTERNAL_KEYS = ["auditLog", "auditLogFailed", "bankTransferReview", "pairedDevice", "userLineProfile", "userLoginEvent", "userXProfile"];
const NO_IMPORT_KEYS = ["user", "coupon", "userTag", "referral", "referralReward", "milestone"];

// ---------------------------------------------------------------------------
// 1. 実リポの登録表
// ---------------------------------------------------------------------------

test("serviceRegistry.ts は domainEntry.ts からの生成結果と一致する（pnpm registry:check）", () => {
  const { errors } = checkServiceRegistry(repoRoot);
  assert.deepEqual(errors, []);
  const text = fs.readFileSync(path.join(repoRoot, REGISTRY_FILE), "utf8");
  assert.equal(text.split("\n")[0], GENERATED_HEADER);
  assert.equal(buildServiceRegistry(repoRoot).text, text, "再生成しても差分 0");
});

test("domainEntry.ts の静的 import は @/lib/domain/types と access のプリセットだけ", () => {
  const domains = discoverDomainEntries(repoRoot).filter((domain) => domain.entryPath);
  assert.ok(domains.length >= 26);
  for (const domain of domains) {
    const text = fs.readFileSync(path.join(repoRoot, domain.entryPath), "utf8");
    for (const source of listStaticImports(text)) {
      assert.ok(
        ["@/lib/domain/types", "@/config/app/domain-api-access.config"].includes(source),
        `${domain.entryPath}: ${source}`,
      );
    }
    assert.match(text, /satisfies DomainEntries;/, `${domain.entryPath}: satisfies DomainEntries を付ける`);
  }
});

test("登録された全エントリは service() でオブジェクトを返し、Drizzle 版は getTableName / getIdColumnName を持つ", async () => {
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
    } else {
      assert.equal(key, "chatRoom", "getTableName を持たないのは Firestore 版の chatRoom だけ");
    }
  }
});

test("core 7 キーは登録されているが、汎用 API・全件削除の一覧・データ移行のどれにも出ない", async () => {
  for (const key of INTERNAL_KEYS) {
    assert.ok(hasService(serviceRegistry, key), `${key} が登録表に無い`);
    const { access } = serviceRegistry[key];
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
  const listed = (await getDomainList(serviceRegistry, domainConfigMap)).map((domain) => domain.key);
  for (const key of INTERNAL_KEYS) {
    const inList = listed.includes(key);
    assert.ok(inList, `${key}: truncateAll を持つので一覧の候補には出る（ルートが access で除く）`);
    assert.equal(resolveAccessRule(serviceRegistry[key].access, "truncateAll", "write"), "none");
  }
  // chatRoom（Firestore）は truncateAll を持たないので候補にも出ない
  assert.ok(!listed.includes("chatRoom"));
});

test("useImportExport: false の core は import だけ閉じ、export / truncateAll は管理者（今までの挙動）", () => {
  for (const key of NO_IMPORT_KEYS) {
    const { access } = serviceRegistry[key];
    assert.equal(resolveAccessRule(access, "import", "write"), "none", `${key}: import`);
    assert.deepEqual(resolveAccessRule(access, "export", "write"), ADMIN_RULE, `${key}: export`);
    assert.deepEqual(resolveAccessRule(access, "truncateAll", "write"), ADMIN_RULE, `${key}: truncateAll`);
    assert.deepEqual(resolveAccessRule(access, "list", "read"), ADMIN_RULE, `${key}: list`);
  }
  // それ以外の既存 core 行はデータ操作 3 つとも管理者
  for (const key of ["setting", "wallet", "walletHistory", "purchaseRequest", "couponHistory", "userCounter", "interactionEvent", "notification", "notificationTemplate", "chatRoom", "deviceFingerprint", "fingerprintChallenge", "couponAttributionReward", "couponIssuerGrant"]) {
    for (const operation of DOMAIN_DATA_OPERATIONS) {
      assert.deepEqual(resolveAccessRule(serviceRegistry[key].access, operation, "write"), ADMIN_RULE, `${key}: ${operation}`);
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

const ENTRY = (key, service = `${key}Service`) => `import type { DomainEntries } from "@/lib/domain/types";
import { ADMIN_ONLY } from "@/config/app/domain-api-access.config";

export const domainEntries = {
  ${key}: { service: () => import("./${service}").then((m) => m.${service}), access: ADMIN_ONLY },
} satisfies DomainEntries;
`;

function makeRoot(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "service-registry-"));
  tempRoots.push(root);
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return root;
}

test("生成: core → 業務の順に並び、override は access だけ差し替え、2 回目は変更なし", (t) => {
  t.mock.method(console, "log", () => {});
  const root = makeRoot({
    "src/features/core/user/services/server/domainEntry.ts": ENTRY("user"),
    "src/features/core/user/services/server/drizzleBase.ts": "",
    "src/features/core/userTag/services/server/domainEntry.ts": ENTRY("userTag"),
    "src/features/core/userTag/services/server/domainEntry.override.ts": `import type { DomainEntryOverrides } from "@/lib/domain/types";
import { PUBLIC_READ } from "@/config/app/domain-api-access.config";
export const domainEntryOverrides = { userTag: PUBLIC_READ } satisfies DomainEntryOverrides;
`,
    "src/features/article/services/server/domainEntry.ts": ENTRY("article"),
    "src/features/article/domain.json": "{}",
  });
  const first = generateServiceRegistry(root);
  assert.equal(first.written, true);
  const text = fs.readFileSync(path.join(root, REGISTRY_FILE), "utf8");
  assert.equal(text.split("\n")[0], GENERATED_HEADER);
  assert.match(text, /import \{ domainEntries as userEntries \} from "@\/features\/core\/user\/services\/server\/domainEntry";/);
  assert.match(text, /import \{ domainEntryOverrides as userTagEntriesOverrides \} from "@\/features\/core\/userTag\/services\/server\/domainEntry.override";/);
  assert.match(text, /\n  user: userEntries\.user,\n  userTag: \{ service: userTagEntries\.userTag\.service, access: userTagEntriesOverrides\.userTag \},\n  article: articleEntries\.article,\n\};/);
  assert.deepEqual(readObjectKeys(text, "serviceRegistry").keys, ["user", "userTag", "article"]);
  const second = generateServiceRegistry(root);
  assert.equal(second.written, false);
  assert.deepEqual(checkServiceRegistry(root).errors, []);
});

test("検査: 生成ヘッダの無い旧ファイルの手書き行は失敗し、移し先を出す。生成ヘッダ付きなら dc:delete 後の除去として通す", (t) => {
  t.mock.method(console, "log", () => {});
  const root = makeRoot({
    "src/features/core/user/services/server/domainEntry.ts": ENTRY("user"),
    "src/features/sample/domain.json": "{}",
    "src/features/sample/services/server/sampleService.ts": "",
    [REGISTRY_FILE]: `import { userService } from "@/features/user/services/server/userService";
import { sampleService } from "@/features/sample/services/server/sampleService";
import { legacyService } from "@/features/legacy/services/server/legacyService";
export const serviceRegistry = {
  user: { service: userService, access: ADMIN_ONLY },
  sample: { service: sampleService, access: ADMIN_ONLY },
  legacy: { service: legacyService, access: ADMIN_ONLY },
};
`,
  });
  const { errors } = checkServiceRegistry(root);
  assert.equal(errors.filter((error) => error.includes('手書きの行 "user"')).length, 0, "domainEntry.ts があるキーは手書き扱いしない");
  assert.match(errors.find((error) => error.includes('手書きの行 "sample"')), /domain.json の apiAccess に移し、pnpm dc:generate sample --yes --only registry/);
  assert.match(errors.find((error) => error.includes('手書きの行 "legacy"')), /対応するドメインが見つからない/);
  assert.throws(() => generateServiceRegistry(root), /手書きの行 "sample"/);

  // 生成ヘッダ付き（移行後）なら、domainEntry.ts の無いキーは除去として通る
  fs.writeFileSync(path.join(root, REGISTRY_FILE), `${GENERATED_HEADER}\nexport const serviceRegistry = {\n  user: 1,\n  gone: 2,\n};\n`);
  const result = generateServiceRegistry(root);
  assert.deepEqual(result.removed, ["gone"]);
  assert.deepEqual(checkServiceRegistry(root).errors, []);
});

test("検査: 重複キー・base があるのに domainEntry.ts が無い・record_type・許可外 import・override の不整合・読めない行", () => {
  const root = makeRoot({
    "src/features/core/user/services/server/domainEntry.ts": ENTRY("user"),
    "src/features/core/dup/services/server/domainEntry.ts": ENTRY("user"),
    "src/features/core/orphan/services/server/drizzleBase.ts": "",
    "src/features/core/orphan/services/server/photo.ts": 'storageBindingFor("orphanPhoto", [])',
    "src/features/core/orphan/services/server/photo.test.ts": 'storageBindingFor("ignored", [])',
    "src/features/core/leak/services/server/domainEntry.ts": `import { leakService } from "./leakService";\nexport const domainEntries = { leak: { service: async () => leakService, access: {} } };\n`,
    "src/features/core/lonely/services/server/domainEntry.override.ts": `export const domainEntryOverrides = { nope: {} };\n`,
    "src/features/core/broken/services/server/domainEntry.ts": `export const other = {};\n`,
    "src/features/business/domain.json": "{}",
    "src/features/business/services/server/drizzleBase.ts": "",
  });
  const { errors } = checkServiceRegistry(root);
  const expect = (pattern) => assert.ok(errors.some((error) => pattern.test(error)), `${pattern} が無い:\n${errors.join("\n")}`);
  expect(/キー "user" が重複している/);
  expect(/core\/orphan\/services\/server に drizzleBase.ts .* domainEntry.ts が無い（手書きする/);
  expect(/core\/business|business\/services\/server に drizzleBase.ts .*pnpm dc:generate business --yes --only registry/);
  expect(/storageBindingFor\("orphanPhoto"\) の record_type が登録表のキーに無い/);
  assert.ok(!errors.some((error) => error.includes('"ignored"')), "*.test.* は走査しない");
  expect(/leak\/services\/server\/domainEntry.ts: "\.\/leakService" を静的 import している/);
  expect(/lonely\/services\/server\/domainEntry.override.ts: 隣に domainEntry.ts が無い/);
  expect(/broken\/services\/server\/domainEntry.ts: export const domainEntries が無い/);
  expect(/serviceRegistry.ts が無い → pnpm registry:generate/);
});
