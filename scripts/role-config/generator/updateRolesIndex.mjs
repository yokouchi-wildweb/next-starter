// scripts/role-config/generator/updateRolesIndex.mjs
// roles/index.ts の更新

import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { toCamelCase } from "../../../src/utils/stringCase.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..", "..");
const ROLES_INDEX_PATH = path.join(
  ROOT_DIR,
  "src/features/core/user/roles/index.ts"
);

/**
 * roles/index.ts にロールを追加
 *
 * 処理:
 * 1. import 文を追加（"// 追加ロール" の後）
 * 2. ALL_ROLES 配列に追加
 */
export function updateRolesIndex(roleConfig) {
  let content = fs.readFileSync(ROLES_INDEX_PATH, "utf-8");
  const roleId = roleConfig.id;
  const varName = `${toCamelCase(roleId)}Role`;

  // 1. import 文を追加
  // "// 追加ロール" の後に追加
  const importLine = `import ${varName} from "./${roleId}.role.json";`;

  // 既存の追加ロール import の最後を探す
  const importSectionMatch = content.match(
    /(\/\/ 追加ロール\n)((?:import \w+Role from "\.\/[\w-]+\.role\.json";\n)*)/
  );

  if (importSectionMatch) {
    const [fullMatch, comment, existingImports] = importSectionMatch;
    const newImports = existingImports + importLine + "\n";
    content = content.replace(fullMatch, comment + newImports);
  } else {
    // フォールバック: 最後の import の後に追加
    const lastImportMatch = content.match(/import .+ from "\.\/[\w-]+\.role\.json";/g);
    if (lastImportMatch) {
      const lastImport = lastImportMatch[lastImportMatch.length - 1];
      content = content.replace(lastImport, lastImport + "\n" + importLine);
    }
  }

  // 2. ALL_ROLES 配列に追加
  // 配列の閉じ括弧の前に追加
  const allRolesMatch = content.match(
    /(export const ALL_ROLES: readonly RoleConfig\[\] = \[[\s\S]*?)(  \/\/ 追加ロール\n)((?:  \w+Role as RoleConfig,\n)*?)(\];)/
  );

  if (allRolesMatch) {
    const [fullMatch, prefix, comment, existingEntries, suffix] = allRolesMatch;
    const newEntry = `  ${varName} as RoleConfig,\n`;
    const newContent = prefix + comment + existingEntries + newEntry + suffix;
    content = content.replace(fullMatch, newContent);
  } else {
    // フォールバック: ]; の前に追加
    content = content.replace(
      /(\];)\s*$/m,
      `  ${varName} as RoleConfig,\n$1`
    );
  }

  fs.writeFileSync(ROLES_INDEX_PATH, content);
}
