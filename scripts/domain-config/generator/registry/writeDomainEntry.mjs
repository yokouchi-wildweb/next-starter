import fs from 'fs';
import path from 'path';
import { domainTableName } from '../../utils/tableName.mjs';
import { ACCESS_PRESETS, PRESET_MODULE, serializeAccess } from './utils/presetAccess.mjs';

// fail-closed 既定（apiAccess 未宣言ドメイン用）。出力は ...ADMIN_ONLY になる。
const FAIL_CLOSED_ACCESS = ACCESS_PRESETS.ADMIN_ONLY;

/**
 * domain.json から domainEntry.ts の access を組む。
 * - read / write = apiAccess（無ければ ADMIN_ONLY）
 * - operations = apiAccess.operations + 管理データ操作: truncateAll は管理者、export / import は useImportExport が偽なら "none"、それ以外は管理者
 */
export function buildDomainEntryAccess(config) {
  const apiAccess = config?.apiAccess ?? null;
  const base = apiAccess ? { read: apiAccess.read, write: apiAccess.write } : FAIL_CLOSED_ACCESS;
  const adminRule = { roleCategories: ['admin'] };
  const dataRule = config?.useImportExport === false ? 'none' : adminRule;
  return {
    ...base,
    operations: {
      ...(apiAccess?.operations ?? {}),
      truncateAll: adminRule,
      export: dataRule,
      import: dataRule,
    },
  };
}

/**
 * 登録の table / idColumn の行。Firestore 版は表を持たないので null。
 * それ以外は表の定義の生成器と同じ表名（domainTableName）と、生成器が常に主キーにする id 列
 */
export function renderTableLines(camel, config) {
  if (config?.dbEngine === 'Firestore') {
    return ['    // Firestore 版は表を持たない', '    table: null,', '    idColumn: null,'];
  }
  return [`    table: "${domainTableName(camel, config)}",`, '    idColumn: "id",'];
}

/**
 * domainEntry.ts の本文を作る
 * @param {{ camel: string, config: object | null, isCore?: boolean }} options camel = ドメイン名（camelCase）、config = domain.json（無ければ null）
 */
export function renderDomainEntry({ camel, config, isCore = false }) {
  const { lines, names } = serializeAccess(buildDomainEntryAccess(config));
  const dir = `src/features/${isCore ? 'core/' : ''}${camel}`;
  const out = [
    `// ${dir}/services/server/domainEntry.ts`,
    '// dc:generate が domain.json から生成する（generateFiles.registry）。手で直すときは generateFiles.registry を false にする。',
    '// 登録表 src/registry/serviceRegistry.ts はこのファイルから pnpm registry:generate が作る（dc:generate の最後に自動で走る）。',
    '// access = 汎用 API（/api/<domain>/**）と管理データ操作（truncateAll / export / import）の認可。詳細: src/lib/domain/README.md',
    '',
    'import type { DomainEntries } from "@/lib/domain/types";',
  ];
  if (names.length > 0) out.push(`import { ${names.sort().join(', ')} } from "${PRESET_MODULE}";`);
  out.push('', 'export const domainEntries = {', `  ${camel}: {`, `    service: () => import("./${camel}Service").then((m) => m.${camel}Service),`);
  out.push(...renderTableLines(camel, config), '    access: {');
  for (const line of lines) out.push(`      ${line}`);
  out.push('    },', '  },', '} satisfies DomainEntries;', '');
  return out.join('\n');
}

// domain.json の apiAccess / useImportExport から services/server/domainEntry.ts を書き出す（毎回上書き）。
// apiAccess 未宣言の場合は fail-closed（ADMIN_ONLY）で出力し、警告を出す。
export default function writeDomainEntry({ rootDir, camel }) {
  const domainDir = path.join(rootDir, 'src', 'features', camel);
  const configPath = path.join(domainDir, 'domain.json');
  let config = null;
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {
      config = null;
    }
  }
  if (!config?.apiAccess) {
    console.warn(
      `[domainEntry] ${camel}: domain.json に apiAccess が無いため fail-closed（ADMIN_ONLY）で登録します。` +
        `公開範囲を変えるには domain.json の apiAccess を宣言して再生成してください。`,
    );
  }
  const serverDir = path.join(domainDir, 'services', 'server');
  fs.mkdirSync(serverDir, { recursive: true });
  const file = path.join(serverDir, 'domainEntry.ts');
  const next = renderDomainEntry({ camel, config });
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === next) {
    console.log(`変更なし: ${file}`);
    return;
  }
  fs.writeFileSync(file, next);
  console.log(`更新しました: ${file}`);
}
