import fs from 'fs';
import path from 'path';

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
  let lastImport = -1;
  for (let i = 0; i < content.length; i++) {
    if (content[i].startsWith('import')) lastImport = i;
  }
  // 未登録であれば import 行を挿入
  if (!content.includes(importLine)) {
    content.splice(lastImport + 1, 0, importLine);
  }
  const registryEndMarker = content.findIndex((l) => l.includes('// --- AUTO-GENERATED-END ---'));
  let closingIndex = registryEndMarker;
  if (closingIndex === -1) {
    const registryStart = content.findIndex((l) => l.includes('serviceRegistry'));
    closingIndex = content.findIndex((l, idx) => idx > registryStart && l.trim().startsWith('};'));
  }

  let apiAccess = readApiAccess(rootDir, camel);
  if (!apiAccess) {
    apiAccess = FAIL_CLOSED_ACCESS;
    console.warn(
      `[serviceRegistry] ${camel}: domain.json に apiAccess が無いため fail-closed（admin 限定）で登録します。` +
        `公開範囲を変えるには domain.json の apiAccess を宣言して再生成してください。`,
    );
  }
  const registryLine = `  ${camel}: { service: ${camel}Service, access: ${serializeAccess(apiAccess)} },`;

  // 同一ドメインの既存行（旧 `${camel}: ${camel}Service,` 形式含む）を置換 or 追加
  const existingIdx = content.findIndex((l) => new RegExp(`^\\s*${camel}:\\s`).test(l));
  if (existingIdx !== -1) {
    content[existingIdx] = registryLine;
  } else {
    content.splice(closingIndex, 0, registryLine);
  }
  fs.writeFileSync(servicePath, content.join('\n'));
  console.log(`更新しました: ${servicePath}`);
}
