// 生成器が読み書きするリポジトリの場所。rootDir（既定 = カレントディレクトリ）からの全パスをここで組む。
// ファイルを読むのはこのモジュールと pipeline/apply（書き込み）・pipeline/remove だけ。render/ と checks/ は読まない。
//
// ドメインの所在: business = src/domains/<camel>、core = src/domains/core/<camel>（domain.json を持つものだけが生成の対象）。
// 違いはフォルダだけで、生成・検査・generate の旗は同じ扱い。両方に domain.json があれば止める（locateDomain）

import fs from "node:fs";
import path from "node:path";

const NOT_DOMAIN_DIRS = new Set(["_template", "core"]);

/**
 * @param {string} [rootDir] リポジトリのルート（src/ を含むディレクトリ）
 */
export function createWorkspace(rootDir = process.cwd()) {
  const domainsDir = path.join(rootDir, "src", "domains");
  const templateDir = path.join(domainsDir, "_template");

  const coreDir = path.join(domainsDir, "core");
  const domainPath = (...segments) => path.join(domainsDir, ...segments);
  const hasConfig = (dir) => fs.existsSync(path.join(dir, "domain.json"));

  /**
   * ドメインの所在。domain.json のある方（両方にあれば例外）、どちらにも無ければ business の位置
   * @param {string} camel フォルダ名
   * @returns {{ kind: "business" | "core", dir: string, configPath: string, rel: string }} rel = リポジトリからの相対（例: src/domains/core/user）
   */
  function locateDomain(camel) {
    const business = domainPath(camel);
    const core = path.join(coreDir, camel);
    const inBusiness = hasConfig(business);
    const inCore = camel !== "core" && hasConfig(core);
    if (inBusiness && inCore) {
      throw new Error(`ドメイン "${camel}" の domain.json が src/domains/${camel}/ と src/domains/core/${camel}/ の両方にあります。どちらかに 1 つだけにしてください`);
    }
    const kind = inCore ? "core" : "business";
    const dir = inCore ? core : business;
    return { kind, dir, configPath: path.join(dir, "domain.json"), rel: path.relative(rootDir, dir).split(path.sep).join("/") };
  }
  const configPath = (camel) => locateDomain(camel).configPath;

  /** domain.json を読む。無ければ null（壊れた JSON は例外） */
  function readConfig(camel) {
    const file = configPath(camel);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  }

  /** domain.json を読む。壊れていれば null（リレーション先の表名の解決など、失敗しても続ける場面用） */
  function readConfigLenient(file) {
    try {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      return null;
    }
  }

  /** domain.json を持つドメインのフォルダ名（business = src/domains 直下、core = src/domains/core 直下。_template は除く。ソート済み）。名前が重なれば例外 */
  function listDomains() {
    const dirsIn = (dir) =>
      fs.existsSync(dir)
        ? fs
            .readdirSync(dir, { withFileTypes: true })
            .filter((dirent) => dirent.isDirectory() && !NOT_DOMAIN_DIRS.has(dirent.name) && hasConfig(path.join(dir, dirent.name)))
            .map((dirent) => dirent.name)
        : [];
    const names = [...dirsIn(domainsDir), ...dirsIn(coreDir)];
    for (const name of names) locateDomain(name); // 重なりを止める
    return [...new Set(names)].sort();
  }

  /** 地区の地図(src/registry/district-map.jsonl)の場所と今の中身(無ければ null)。中身を作るのは scripts/structure/district-map */
  const districtMapPath = path.join(rootDir, "src", "registry", "district-map.jsonl");
  const readDistrictMap = () => (fs.existsSync(districtMapPath) ? fs.readFileSync(districtMapPath, "utf8") : null);

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
    formInputsDir: path.join(rootDir, "src", "wiring", "formInputs", "inputs"),
    domainPath,
    locateDomain,
    configPath,
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
