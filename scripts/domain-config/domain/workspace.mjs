// 生成器が読み書きするリポジトリの場所。rootDir（既定 = カレントディレクトリ）からの全パスをここで組む。
// ファイルを読むのはこのモジュールと pipeline/apply（書き込み）・pipeline/remove だけ。render/ と checks/ は読まない。
//
// ドメインの所在: business = src/features/<camel>、core = src/features/core/<camel>（domain.json を持つものだけが生成の対象）。
// 違いはフォルダだけで、生成・検査・generate の旗は同じ扱い。両方に domain.json があれば止める（locateDomain）

import fs from "node:fs";
import path from "node:path";

const NOT_DOMAIN_DIRS = new Set(["_template", "core"]);

/**
 * @param {string} [rootDir] リポジトリのルート（src/ を含むディレクトリ）
 */
export function createWorkspace(rootDir = process.cwd()) {
  const featuresDir = path.join(rootDir, "src", "features");
  const templateDir = path.join(featuresDir, "_template");

  const coreDir = path.join(featuresDir, "core");
  const featurePath = (...segments) => path.join(featuresDir, ...segments);
  const hasConfig = (dir) => fs.existsSync(path.join(dir, "domain.json"));

  /**
   * ドメインの所在。domain.json のある方（両方にあれば例外）、どちらにも無ければ business の位置
   * @param {string} camel フォルダ名
   * @returns {{ kind: "business" | "core", dir: string, configPath: string, rel: string }} rel = リポジトリからの相対（例: src/features/core/user）
   */
  function locateDomain(camel) {
    const business = featurePath(camel);
    const core = path.join(coreDir, camel);
    const inBusiness = hasConfig(business);
    const inCore = camel !== "core" && hasConfig(core);
    if (inBusiness && inCore) {
      throw new Error(`ドメイン "${camel}" の domain.json が src/features/${camel}/ と src/features/core/${camel}/ の両方にあります。どちらかに 1 つだけにしてください`);
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

  /** domain.json を持つドメインのフォルダ名（business = src/features 直下、core = src/features/core 直下。_template は除く。ソート済み）。名前が重なれば例外 */
  function listDomains() {
    const dirsIn = (dir) =>
      fs.existsSync(dir)
        ? fs
            .readdirSync(dir, { withFileTypes: true })
            .filter((dirent) => dirent.isDirectory() && !NOT_DOMAIN_DIRS.has(dirent.name) && hasConfig(path.join(dir, dirent.name)))
            .map((dirent) => dirent.name)
        : [];
    const names = [...dirsIn(featuresDir), ...dirsIn(coreDir)];
    for (const name of names) locateDomain(name); // 重なりを止める
    return [...new Set(names)].sort();
  }

  /** フォルダ名（_ で始まるもの・ファイルは除く。ソート済み） */
  const foldersIn = (dir, exclude = new Set()) =>
    fs.existsSync(dir)
      ? fs
          .readdirSync(dir, { withFileTypes: true })
          .filter((dirent) => dirent.isDirectory() && !dirent.name.startsWith("_") && !exclude.has(dirent.name))
          .map((dirent) => dirent.name)
          .sort()
      : [];

  /** ドメインの一覧（domain/featureMap.mjs）の材料: business・core のフォルダと generate（domain.json なし = null、壊れた JSON = "?"） */
  function featureListing() {
    const entry = (dir) => (name) => {
      const file = path.join(dir, name, "domain.json");
      if (!fs.existsSync(file)) return { name, generate: null };
      const config = readConfigLenient(file);
      return { name, generate: config === null ? "?" : config.generate !== false };
    };
    return { business: foldersIn(featuresDir, new Set(["core"])).map(entry(featuresDir)), core: foldersIn(coreDir).map(entry(coreDir)) };
  }

  const featureMapPath = path.join(rootDir, "src", "features", "feature-map.txt");

  /** 今の feature-map.txt（無ければ null） */
  const readFeatureMap = () => (fs.existsSync(featureMapPath) ? fs.readFileSync(featureMapPath, "utf8") : null);

  /** テンプレート（src/features/_template/...）を読む。無ければ例外 */
  function readTemplate(...segments) {
    const file = path.join(templateDir, ...segments);
    if (!fs.existsSync(file)) {
      throw new Error(`テンプレートが見つかりません: ${file}`);
    }
    return fs.readFileSync(file, "utf8");
  }

  return {
    rootDir,
    featureMapPath,
    featureListing,
    readFeatureMap,
    featuresDir,
    templateDir,
    adminTemplateDir: path.join(rootDir, "src", "app", "admin", "_template"),
    adminProtectedDir: path.join(rootDir, "src", "app", "admin", "(protected)"),
    rolesDir: path.join(coreDir, "user", "roles"),
    coreRolesDir: path.join(coreDir, "user", "coreRoles"),
    featurePath,
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
