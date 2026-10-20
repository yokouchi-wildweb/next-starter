import fs from 'fs';
import path from 'path';
import { upsertObjectEntry } from './utils/objectEntry.mjs';

// fail-closed 既定（apiAccess 未宣言ドメイン用）。serviceRegistry の ADMIN_ONLY と同義。
const FAIL_CLOSED_ACCESS = { read: { roleCategories: ['admin'] }, write: { roleCategories: ['admin'] } };

// domain.json の apiAccess を読み取る。無ければ null。
function readApiAccess(rootDir, camel) {
  const configPath = path.join(rootDir, 'src', 'features', camel, 'domain.json');
  if (!fs.existsSync(configPath)) return null;
  try {
    const json = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return json.apiAccess ?? null;
  } catch {
    return null;
  }
}

// access オブジェクトを 1 行の TS リテラルとして直列化する（JSON は有効な TS オブジェクトリテラル）。
function serializeAccess(access) {
  return JSON.stringify(access);
}

// サービス登録ファイルに新しいサービスを追記する。
// 値は { service, access } 形式（access は型必須）。access は domain.json の apiAccess を展開し、
// 未宣言の場合は fail-closed（admin 限定）を出力して警告する。
export default function updateServiceRegistry({ rootDir, camel }) {
  const servicePath = path.join(rootDir, 'src', 'registry', 'serviceRegistry.ts');
  // レジストリが無ければ何もしない
  if (!fs.existsSync(servicePath)) return;
  const content = fs.readFileSync(servicePath, 'utf8').split(/\r?\n/);
  const importLine = `import { ${camel}Service } from "@/features/${camel}/services/server/${camel}Service";`;
  // 引用符・空白の違い（Prettier 整形等）があっても登録済みとみなす
  const importPattern = new RegExp(
    `^\\s*import\\s*\\{\\s*${camel}Service\\s*\\}\\s*from\\s*["']@/features/${camel}/services/server/${camel}Service["']`,
  );
  let lastImport = -1;
  for (let i = 0; i < content.length; i++) {
    if (content[i].startsWith('import')) lastImport = i;
  }
  // 未登録であれば import 行を挿入
  if (!content.some((l) => importPattern.test(l))) {
    content.splice(lastImport + 1, 0, importLine);
  }

  let apiAccess = readApiAccess(rootDir, camel);
  if (!apiAccess) {
    apiAccess = FAIL_CLOSED_ACCESS;
    console.warn(
      `[serviceRegistry] ${camel}: domain.json に apiAccess が無いため fail-closed（admin 限定）で登録します。` +
        `公開範囲を変えるには domain.json の apiAccess を宣言して再生成してください。`,
    );
  }
  // serviceRegistry 直下の同一ドメインのエントリ（旧 `${camel}: ${camel}Service,` 形式・複数行整形を含む）を
  // 丸ごと置換 or AUTO-GENERATED-END の直前へ追加
  const updated = upsertObjectEntry(content.join('\n'), {
    objectName: 'serviceRegistry',
    key: camel,
    value: `{ service: ${camel}Service, access: ${serializeAccess(apiAccess)} }`,
  });
  fs.writeFileSync(servicePath, updated);
  console.log(`更新しました: ${servicePath}`);
}
