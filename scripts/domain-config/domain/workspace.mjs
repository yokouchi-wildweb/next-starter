// 生成器が読み書きするリポジトリの場所。rootDir（既定 = カレントディレクトリ）からの全パスをここで組む。
// ファイルを読むのはこのモジュールと pipeline/apply（書き込み）・pipeline/remove だけ。render/ と checks/ は読まない。

import fs from "node:fs";
import path from "node:path";

const NOT_DOMAIN_DIRS = new Set(["_template", "core"]);

/**
 * @param {string} [rootDir] リポジトリのルート（src/ を含むディレクトリ）
 */
export function createWorkspace(rootDir = process.cwd()) {
  const featuresDir = path.join(rootDir, "src", "features");
  const templateDir = path.join(featuresDir, "_template");

  const featurePath = (...segments) => path.join(featuresDir, ...segments);
  const configPath = (camel) => featurePath(camel, "domain.json");

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

  /** src/features 直下で domain.json を持つフォルダ名（ソート済み。_template / core は除く） */
  function listDomains() {
    return fs
      .readdirSync(featuresDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory() && !NOT_DOMAIN_DIRS.has(dirent.name))
      .map((dirent) => dirent.name)
      .filter((name) => fs.existsSync(configPath(name)))
      .sort();
  }

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
    featuresDir,
    templateDir,
    adminTemplateDir: path.join(rootDir, "src", "app", "admin", "_template"),
    adminProtectedDir: path.join(rootDir, "src", "app", "admin", "(protected)"),
    rolesDir: path.join(featuresDir, "core", "user", "roles"),
    featurePath,
    configPath,
    registryPath: (fileName) => path.join(rootDir, "src", "registry", fileName),
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
