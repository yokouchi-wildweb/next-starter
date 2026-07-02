#!/usr/bin/env node
// scripts/check/domain-route-shadow.mjs
//
// 静的フォルダ・シャドーイング検出（CI ガード）。
//
// 背景:
//   Next.js App Router は静的セグメントを動的 [domain] より優先解決する。
//   serviceRegistry 登録済みドメイン <domain> に対し src/app/api/<domain>/ という
//   静的フォルダが存在すると、/api/<domain>/<id> や /api/<domain>（コレクション）等の
//   汎用オペレーションが /api/[domain]/** にフォールバックせず 404 になる。
//   その結果、クライアント CRUD（createApiClient / use<Domain> / useUpdate<Domain>）が
//   無言で壊れる（SSR は service 直呼びのため露見しにくい）。
//
// このガードは、登録済みドメインの静的フォルダが汎用 ID ルートを再公開していない
// ケースを検出して非ゼロ終了する。
//   復旧方法: src/app/api/<domain>/[id]/route.ts に
//     export const { GET, PUT, DELETE } = createDomainIdRouteFor("<domain>");
//   コレクションも必要なら src/app/api/<domain>/route.ts に
//     export const { GET, POST } = createDomainCollectionRouteFor("<domain>");
//
// 意図的に汎用 CRUD を再公開しないドメイン（webhook 専用フォルダ等）は
// ACKNOWLEDGED_SHADOWS に登録して抑止する。

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { toCamelCase } from "../../src/utils/stringCase.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const SRC_DIR = join(ROOT, "src");
const API_DIR = join(ROOT, "src", "app", "api");
const REGISTRY_FILE = join(ROOT, "src", "registry", "serviceRegistry.ts");

// 汎用 CRUD の再公開を意図的に行わない登録済みドメインの静的フォルダ（camelCase キー）。
// ここに載せたものはシャドーイング検査から除外する。
const ACKNOWLEDGED_SHADOWS = new Set([]);

/**
 * serviceRegistry.ts から登録済みドメインのキー（camelCase）を抽出する。
 * `export const serviceRegistry: Record<string, DomainRegistryEntry> = { ... }`
 * のオブジェクト本体からトップレベルキーのみを拾う。
 */
function extractRegisteredDomains() {
  const src = readFileSync(REGISTRY_FILE, "utf8");
  // コメント内の "serviceRegistry" 言及を避けるため、宣言 `= {` を厳密にアンカーする。
  const declIdx = src.indexOf("export const serviceRegistry");
  if (declIdx === -1) {
    throw new Error("serviceRegistry の宣言が見つかりません");
  }
  const eqIdx = src.indexOf("= {", declIdx);
  if (eqIdx === -1) {
    throw new Error("serviceRegistry のオブジェクト本体が見つかりません");
  }
  const braceIdx = src.indexOf("{", eqIdx);

  // 対応する閉じ括弧までを深さカウントで切り出す
  let depth = 0;
  let endIdx = -1;
  for (let i = braceIdx; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        endIdx = i;
        break;
      }
    }
  }
  const body = src.slice(braceIdx + 1, endIdx);

  const domains = new Set();
  const keyPattern = /(^|\n)\s*([A-Za-z][A-Za-z0-9]*)\s*:\s*\{/g;
  let match;
  while ((match = keyPattern.exec(body)) !== null) {
    // ネストした { service, access } 内部の `service:` `access:` を拾わないよう、
    // トップレベル（キーの直後が別オブジェクト開始）判定は depth 追跡が理想だが、
    // 登録エントリのキーは必ず `<domain>: {` の形なので、既知の内部キーを除外する。
    const key = match[2];
    if (key === "service" || key === "access" || key === "operations") continue;
    domains.add(key);
  }
  return domains;
}

/**
 * src 配下を走査し、createApiClient("/api/<segment>...") で束縛されている
 * トップレベル URL セグメントの集合を返す。
 * これらのセグメントに一致する静的フォルダは「汎用クライアント CRUD を実際に使う」
 * ＝ シャドーイングで実害が出るドメイン。custom ルートのみのフォルダは含まれない。
 */
function collectApiClientSegments() {
  const segments = new Set();
  // createApiClient(...) の第1引数の "/api/<...>" を拾う（型引数 <...> は任意）
  const pattern = /createApiClient\s*(?:<[^>]*>)?\s*\(\s*["'`]\/api\/([^"'`]+)["'`]/g;

  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".next") continue;
        walk(full);
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        const content = readFileSync(full, "utf8");
        if (!content.includes("createApiClient")) continue;
        let m;
        while ((m = pattern.exec(content)) !== null) {
          // 汎用 CRUD クライアントは base が「/api/<domain>」の単一セグメント。
          // /api/notification/my のような custom サブパスは汎用ルートに依存しないため除外。
          const path = m[1].replace(/\/+$/, "");
          if (path && !path.includes("/")) segments.add(path);
        }
      }
    }
  };
  walk(SRC_DIR);
  return segments;
}

/**
 * 静的フォルダが汎用 ID ルートを再公開しているか判定する。
 * <folder>/[id]/route.ts が存在し createDomainIdRouteFor を使っていれば OK とみなす。
 */
function reExposesIdRoute(folderPath) {
  const idRoute = join(folderPath, "[id]", "route.ts");
  if (!existsSync(idRoute)) return false;
  const content = readFileSync(idRoute, "utf8");
  return content.includes("createDomainIdRouteFor");
}

function main() {
  const registered = extractRegisteredDomains();
  const clientSegments = collectApiClientSegments();

  const entries = readdirSync(API_DIR, { withFileTypes: true });
  const problems = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const name = entry.name;
    // 動的セグメント・ルートグループは対象外
    if (name.startsWith("[") || name.startsWith("(")) continue;

    const domainKey = toCamelCase(name);
    if (!registered.has(domainKey)) continue; // 登録ドメインでなければ汎用ルートは無い

    // createApiClient("/api/<name>") で汎用クライアント CRUD を実際に束縛している
    // ドメインだけが実害を受ける。custom ルート専用フォルダ（redeem/send 等）は対象外。
    if (!clientSegments.has(name)) continue;

    if (ACKNOWLEDGED_SHADOWS.has(domainKey)) continue;

    const folderPath = join(API_DIR, name);
    if (!reExposesIdRoute(folderPath)) {
      problems.push({ name, domainKey, folderPath });
    }
  }

  if (problems.length === 0) {
    console.log("✓ 静的フォルダ・シャドーイングの問題は検出されませんでした");
    return;
  }

  console.error("✗ 静的フォルダ・シャドーイングを検出しました:\n");
  for (const p of problems) {
    console.error(
      `  - src/app/api/${p.name}/ は登録済みドメイン "${p.domainKey}" の静的フォルダですが、` +
        `汎用 ID ルートを再公開していません。`,
    );
    console.error(
      `    /api/${p.name}/<id> が /api/[domain]/[id] にフォールバックせず 404 になり、` +
        `クライアント CRUD（getById/update/remove）が壊れます。`,
    );
    console.error(
      `    → src/app/api/${p.name}/[id]/route.ts に ` +
        `\`export const { GET, PUT, DELETE } = createDomainIdRouteFor("${p.domainKey}");\` を追加してください。`,
    );
    console.error(
      `    （意図的に汎用 CRUD を公開しない場合は scripts/check/domain-route-shadow.mjs の ` +
        `ACKNOWLEDGED_SHADOWS に "${p.domainKey}" を追加）\n`,
    );
  }
  process.exit(1);
}

main();
