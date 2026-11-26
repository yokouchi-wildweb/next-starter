// 生成器が読み書きするリポジトリの場所。rootDir（既定 = カレントディレクトリ）からの全パスをここで組む。
// ファイルを読むのはこのモジュールと pipeline/apply（書き込み）・pipeline/remove だけ。render/ と checks/ は読まない。
//
// ドメインの所在: business = src/domains/<camel>、core = src/domains/core/<camel>（違いはフォルダだけで、生成・検査・generate の旗は同じ扱い）。
// 宣言は読み込みの部品 readDomain(src/lib/domain、D335)だけで読む。生成器の 1 ドメインの config = その主の登録
// (登録名 = ドメイン名、表 1 つのドメイン)の entity.json。生成する登録(generate、D337)を持つのに登録が 2 つ以上のドメインは止める
// (登録ごとの一式は区切り domain-kit)

import fs from "node:fs";
import path from "node:path";

import { readDistrictMapAt } from "../../../../src/lib/districtMap/node.mjs";
import {
  DOMAIN_DECLARATION_FILE,
  ENTITIES_DIR,
  ENTITY_DECLARATION_FILE,
  findRegistration,
  isGeneratedRegistration,
  listDomains as listDeclaredDomains,
  nodeDomainSource,
  primaryRegistrationOf,
  readDomain,
  readDomains,
} from "../../../../src/lib/domain/node.mjs";
import { CACHE_FILE } from "../spec/cache.mjs";

const NOT_DOMAIN_DIRS = new Set(["_template", "core"]);

/**
 * @param {string} [rootDir] リポジトリのルート（src/ を含むディレクトリ）
 */
export function createWorkspace(rootDir = process.cwd()) {
  const domainsDir = path.join(rootDir, "src", "domains");
  const templateDir = path.join(domainsDir, "_template");

  const coreDir = path.join(domainsDir, "core");
  const domainPath = (...segments) => path.join(domainsDir, ...segments);
  const source = nodeDomainSource(rootDir);

  /** 宣言(readDomain)。domain.json の無いドメインは null(フォルダだけ・宣言を書く前) */
  function declarationOf(camel) {
    const declaration = readDomain(source, camel);
    return declaration.domain === null ? null : declaration;
  }

  /**
   * ドメインの所在。フォルダのある方(業務と core の両方にあれば例外)、どちらにも無ければ business の位置
   * @param {string} camel フォルダ名
   * @returns {{ kind: "business" | "core", dir: string, configPath: string, rel: string }}
   *   configPath = 主の登録の宣言 entities/<camel>/entity.json(書き出す先。読むのは readConfig)、rel = リポジトリからの相対(例: src/domains/core/user)
   */
  function locateDomain(camel) {
    const listed = listDeclaredDomains(source);
    if (listed.problems.some((problem) => problem.startsWith(`ドメイン "${camel}" `))) {
      throw new Error(`ドメイン "${camel}" のフォルダが src/domains/${camel}/ と src/domains/core/${camel}/ の両方にあります。どちらかに 1 つだけにしてください`);
    }
    const found = camel === "core" ? null : listed.domains.find((domain) => domain.name === camel);
    const kind = found?.core ? "core" : "business";
    const dir = found ? path.join(rootDir, found.dir) : domainPath(camel);
    return { kind, dir, configPath: path.join(dir, ENTITIES_DIR, camel, ENTITY_DECLARATION_FILE), rel: path.relative(rootDir, dir).split(path.sep).join("/") };
  }
  const configPath = (camel) => locateDomain(camel).configPath;
  /** ドメインの宣言 domain.json の場所(従属ドメインを書き出す時) */
  const domainDeclarationPath = (camel) => path.join(locateDomain(camel).dir, DOMAIN_DECLARATION_FILE);

  /**
   * 生成器の config(主の登録の entity.json)。宣言・主の登録が無ければ null(壊れた宣言・登録が 2 つ以上で生成する登録を持つ = 例外)
   * @param {string} camel
   */
  function readConfig(camel) {
    const declaration = declarationOf(camel);
    if (!declaration) return null;
    const broken = declaration.problems.filter((problem) => problem.includes("JSON として読めない") || problem.includes("オブジェクトでない"));
    if (broken.length > 0) throw new Error(broken.join("\n"));
    if (declaration.registrations.length > 1 && declaration.registrations.some(isGeneratedRegistration)) {
      const generated = declaration.registrations.filter(isGeneratedRegistration).map((registration) => registration.name);
      throw new Error(
        `ドメイン "${camel}" は登録が ${declaration.registrations.length} つあり、生成する登録(${generated.join(", ")})を持ちます。` +
          "登録が 2 つ以上のドメインの生成(登録ごとの一式)はまだ無いので、その登録の entity.json に \"generate\": false を書いて手で持ってください",
      );
    }
    const registration = primaryRegistrationOf(declaration);
    return registration?.entity ? { ...registration.entity } : null;
  }

  /** readConfig の失敗を null にする(関連の先の表名の解決など、失敗しても続ける場面用) */
  function readConfigLenient(camel) {
    try {
      return readConfig(camel);
    } catch {
      return null;
    }
  }

  /** 名前の登録の entity.json をどのドメインからでも(関連の先 relations[].domain は登録名)。無ければ null */
  function readRegistration(name) {
    const found = findRegistration(readDomains(source), name);
    return found?.registration.entity ?? null;
  }

  /** 主の登録を持つドメインのフォルダ名（business = src/domains 直下、core = src/domains/core 直下。_template は除く。ソート済み）。名前が重なれば例外 */
  function listDomains() {
    const listed = listDeclaredDomains(source);
    if (listed.problems.length > 0) throw new Error(listed.problems.join("\n").replace(/ が .* の両方にある\(1 つにする\)/, " の宣言が src/domains/ と src/domains/core/ の両方にあります"));
    const names = listed.domains.map((domain) => domain.name).filter((name) => {
      const declaration = declarationOf(name);
      return declaration !== null && primaryRegistrationOf(declaration) !== null;
    });
    return [...new Set(names)].sort();
  }

  /** 地区の地図(src/registry/district-map.jsonl)の場所と今の中身(無ければ null)。中身を作るのは scripts/structure/district-map */
  const districtMapPath = path.join(rootDir, "src", "registry", "district-map.jsonl");
  const readDistrictMap = () => (fs.existsSync(districtMapPath) ? fs.readFileSync(districtMapPath, "utf8") : null);

  /**
   * 入力部品の項目の置き場: 差す側の <ドメイン か lib>/plugs/formInputs/（D40。点の宣言は src/lib/formSuite/extensionPoints.ts の formInputs）。
   * ドメイン（business・core）と lib のフォルダごとに 1 つ（無いフォルダも並べる。読むのは listDir）
   */
  function formInputsDirs() {
    const subdirs = (dir) =>
      fs.existsSync(dir)
        ? fs
            .readdirSync(dir, { withFileTypes: true })
            .filter((dirent) => dirent.isDirectory() && !NOT_DOMAIN_DIRS.has(dirent.name))
            .map((dirent) => path.join(dir, dirent.name))
            .sort()
        : [];
    return [...subdirs(domainsDir), ...subdirs(coreDir), ...subdirs(path.join(rootDir, "src", "lib"))].map((dir) => path.join(dir, "plugs", "formInputs"));
  }

  /** テンプレート（src/domains/_template/...）を読む。無ければ例外 */
  function readTemplate(...segments) {
    const file = path.join(templateDir, ...segments);
    if (!fs.existsSync(file)) {
      throw new Error(`テンプレートが見つかりません: ${file}`);
    }
    return fs.readFileSync(file, "utf8");
  }

  return {
    rootDir,
    districtMapPath,
    readDistrictMap,
    domainsDir,
    templateDir,
    adminTemplateDir: path.join(rootDir, "src", "app", "admin", "_template"),
    adminProtectedDir: path.join(rootDir, "src", "app", "admin", "(protected)"),
    rolesDir: path.join(coreDir, "user", "roles"),
    coreRolesDir: path.join(coreDir, "user", "coreRoles"),
    formInputsDirs,
    domainPath,
    locateDomain,
    configPath,
    domainDeclarationPath,
    readRegistration,
    templatePath: (...segments) => path.join(templateDir, ...segments),
    exists: (file) => fs.existsSync(file),
    readText: (file) => fs.readFileSync(file, "utf8"),
    /** ディレクトリ直下のファイル名（無ければ空） */
    listDir: (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir) : []),
    readConfig,
    readConfigLenient,
    listDomains,
    readTemplate,
  };
}

// ---------------------------------------------------------------------------
// cache の宣言の読み(全ドメイン: generate: false と domain.json の無いドメインも)。検査は checks/cacheDeclarations.mjs(読まない)
// ドメインの一覧は今の木の地区(lib/districtMap の readDistrictMapAt。生成物 district-map.jsonl は他の生成器の入力にしない)
// ---------------------------------------------------------------------------

/** 今の木のドメインの地区(kind domains)を読む */
export function readDomainRows(rootDir) {
  return readDistrictMapAt(rootDir).districts.filter((row) => row.kind === "domains");
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

/**
 * 宣言を 1 ドメインずつ読む(主の登録の entity.json の "cache" か cache.json。両方・置き場の誤り・読めない JSON は problem)
 * @returns {Array<{ row: object, config: object | null, cache: object | null, source: string | null, problem: string | null }>}
 */
export function readCacheDeclarations(rootDir, rows = readDomainRows(rootDir)) {
  const source = nodeDomainSource(rootDir);
  return rows.map((row) => {
    const dir = path.join(rootDir, row.dir);
    const cacheFile = path.join(dir, CACHE_FILE);
    const hasCacheFile = fs.existsSync(cacheFile);
    const declaration = row.domainJson ? readDomain(source, row.name) : null;
    const registration = declaration ? primaryRegistrationOf(declaration) : null;
    const config = registration?.entity ?? null;
    const at = registration ? `${registration.dir}/${ENTITY_DECLARATION_FILE}` : null;
    const inJson = Boolean(config) && config.cache !== undefined;
    const none = { row, config, cache: null, source: null };
    if (inJson && hasCacheFile) return { ...none, problem: `cache は ${at} の "cache" か ${CACHE_FILE} のどちらか 1 つに書いてください(両方ある)` };
    if (config && hasCacheFile) return { ...none, problem: `宣言のある登録は ${CACHE_FILE} でなく ${at} の "cache" に書いてください` };
    if (!inJson && !hasCacheFile) return { ...none, problem: null };
    if (inJson) return { row, config, cache: config.cache, source: at, problem: null };
    try {
      return { row, config, cache: readJson(cacheFile), source: `${row.dir}/${CACHE_FILE}`, problem: null };
    } catch (error) {
      return { ...none, problem: `${CACHE_FILE} が JSON として読めません: ${error.message}` };
    }
  });
}
