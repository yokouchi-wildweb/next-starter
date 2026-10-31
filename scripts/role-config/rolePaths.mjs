// scripts/role-config/rolePaths.mjs
// ロール設定の置き場。core ロールは user/coreRoles/（上流の物。fork は消せない・無効にできない）、追加ロールは user/roles/

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..");
export const CORE_ROLES_DIR = path.join(ROOT_DIR, "src/features/core/user/coreRoles");
export const ROLES_DIR = path.join(ROOT_DIR, "src/features/core/user/roles");

export const CORE_ROLE_IDS = ["admin", "user", "debugger"];
const SUFFIX = ".role.json";

export const isCoreRole = (roleId) => CORE_ROLE_IDS.includes(roleId);

/** @typedef {{ id: string, dir: string, fileName: string, filePath: string, isCore: boolean }} RoleFile */

/** ID から置き場を決める（ファイルがあるかは見ない） */
export function roleFileOf(roleId) {
  const isCore = isCoreRole(roleId);
  const dir = isCore ? CORE_ROLES_DIR : ROLES_DIR;
  const fileName = `${roleId}${SUFFIX}`;
  return { id: roleId, dir, fileName, filePath: path.join(dir, fileName), isCore };
}

/** ロール設定を探す。無ければ null */
export function findRoleFile(roleId) {
  const file = roleFileOf(roleId);
  return fs.existsSync(file.filePath) ? file : null;
}

const namesIn = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => name.endsWith(SUFFIX)) : []);

/** フォルダにあるロール設定のファイル名（検査用: core の ID か、を置き場で決めない） */
export const coreRoleFileNames = () => namesIn(CORE_ROLES_DIR);
export const addedRoleFileNames = () => namesIn(ROLES_DIR);

/** @returns {RoleFile[]} core ロールが先、追加ロールはファイル名順 */
export function listRoleFiles() {
  const fromCore = coreRoleFileNames().map((name) => ({ id: name.slice(0, -SUFFIX.length), dir: CORE_ROLES_DIR, fileName: name, filePath: path.join(CORE_ROLES_DIR, name), isCore: true }));
  const added = addedRoleFileNames().map((name) => ({ id: name.slice(0, -SUFFIX.length), dir: ROLES_DIR, fileName: name, filePath: path.join(ROLES_DIR, name), isCore: false }));
  return [...fromCore, ...added];
}
