// 生成器が読み書きするリポジトリの場所。rootDir（既定 = カレントディレクトリ）からの全パスをここで組む。
// ファイルを読むのはこのモジュールと pipeline/apply（書き込み）・pipeline/remove だけ。render/ と checks/ は読まない。
//
// ドメインの所在: business = src/domains/<camel>、core = src/domains/core/<camel>（違いはフォルダだけで、生成・検査・generate の旗は同じ扱い）。
// 宣言は読み込みの部品 readDomain(src/lib/domain、D335)だけで読む。生成の単位 = ドメインの中の登録 1 件(D336): 登録ごとに
// その entity.json を config にして一式を書く(生成する登録 = generate が false でない物、D337)。config の決まりは ./declarationOf.mjs

import fs from "node:fs";
import path from "node:path";

import { readDistrictMapAt } from "../../../../src/lib/districtMap/node.mjs";
import { ENTITIES_DIR, ENTITY_DECLARATION_FILE, findRegistration, listDomains as listDeclaredDomains, nodeDomainSource, primaryRegistrationOf, readDomain, readDomains } from "../../../../src/lib/domain/node.mjs";
import { ABOLISHED_CACHE_FILE } from "../spec/cache.mjs";
import { cacheDeclarationsOf, configOfDeclaration, generatedRegistrationsOf, registrationConfigOf } from "./declarationOf.mjs";

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

  /** ドメインの主の登録の entity.json(決まりは ./declarationOf.mjs)。宣言が無ければ null */
  const readConfig = (camel) => (declarationOf(camel) ? configOfDeclaration(declarationOf(camel)) : null);

  /** ドメインの中の名前の登録の entity.json(登録ごとの一式の config)。無ければ null */
  const readRegistrationConfig = (domain, registration) => (declarationOf(domain) ? registrationConfigOf(declarationOf(domain), registration) : null);
  /** ドメインの全ての登録(名前と entity.json の写し、フォルダの順)。宣言が無ければ空(主と従属の組を解く: pipeline/pairs.mjs) */
  const registrationsOf = (domain) => declarationOf(domain)?.registrations.map((registration) => ({ name: registration.name, config: registration.entity ? { ...registration.entity } : null })) ?? [];
  /** ドメインの中の登録の entity.json の場所(まだ無い登録を書き出す先) */
  const registrationConfigPath = (domain, registration) => path.join(locateDomain(domain).dir, ENTITIES_DIR, registration, ENTITY_DECLARATION_FILE);

  /**
   * ドメインの生成の単位(登録名の並び): 生成する登録(主が先)。生成する登録が無ければ主の登録だけ(generate: false の知らせを出すため)、
   * 主も無ければ空
   */
  function generationUnitsOf(domain) {
    const declaration = declarationOf(domain);
    if (!declaration) return [];
    const generated = generatedRegistrationsOf(declaration);
    if (generated.length > 0) return generated;
    const primary = primaryRegistrationOf(declaration);
    return primary ? [primary.name] : [];
  }

  /** 登録の置き場の import の根(@/domains/<ドメインのフォルダ名>。core は core/ を省いた別名)。見つからなければ登録名のフォルダ */
  function importRootOf(registration) {
    const found = findRegistration(readDomains(source), registration);
    return `@/domains/${found ? found.declaration.name : registration}`;
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

  /** 主の登録か生成する登録を持つドメインのフォルダ名（business = src/domains 直下、core = src/domains/core 直下。_template は除く。ソート済み）。名前が重なれば例外 */
  function listDomains() {
    const listed = listDeclaredDomains(source);
    if (listed.problems.length > 0) throw new Error(listed.problems.join("\n").replace(/ が .* の両方にある\(1 つにする\)/, " の宣言が src/domains/ と src/domains/core/ の両方にあります"));
    const names = listed.domains.map((domain) => domain.name).filter((name) => {
      const declaration = declarationOf(name);
      return declaration !== null && (primaryRegistrationOf(declaration) !== null || generatedRegistrationsOf(declaration).length > 0);
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

  /** 物理名の表の定義ファイル(地区の地図の tableFiles、リポジトリ相対)と本文。無ければ null(生成器の外部キーの相手を引く) */
  function tableFileOf(physicalName) {
    const found = readDistrictMapAt(rootDir).tableFiles.find((table) => table.name === physicalName);
    return found ? { file: found.file, text: fs.readFileSync(path.join(rootDir, found.file), "utf8") } : null;
  }

  /** テンプレート（src/domains/_template/...）を読む。無ければ例外 */
  function readTemplate(...segments) {
    const file = path.join(templateDir, ...segments);
    if (!fs.existsSync(file)) throw new Error(`テンプレートが見つかりません: ${file}`);
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
    readRegistration,
    tableFileOf,
    templatePath: (...segments) => path.join(templateDir, ...segments),
    exists: (file) => fs.existsSync(file),
    readText: (file) => fs.readFileSync(file, "utf8"),
    /** ディレクトリ直下のファイル名（無ければ空） */
    listDir: (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir) : []),
    readConfig,
    readConfigLenient,
    readRegistrationConfig,
    registrationsOf,
    registrationConfigPath,
    generationUnitsOf,
    importRootOf,
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

/**
 * cache の宣言を登録ごとに読む(D353: 登録の entity.json の "cache"、fork の上書き entity.override.ts の cache。廃止した cache.json は problem)
 * @returns {Array<{ row: object, registration: string | null, config: object | null, cache: object | null, source: string | null, problem: string | null }>}
 */
export function readCacheDeclarations(rootDir, rows = readDomainRows(rootDir)) {
  const source = nodeDomainSource(rootDir);
  return rows.flatMap((row) => {
    const declaration = row.domainJson ? readDomain(source, row.name) : null;
    const readOverride = (registration) => {
      const file = path.join(rootDir, registration.dir, "entity.override.ts");
      return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
    };
    return cacheDeclarationsOf({ row, declaration, hasCacheFile: fs.existsSync(path.join(rootDir, row.dir, ABOLISHED_CACHE_FILE)), readOverride });
  });
}
