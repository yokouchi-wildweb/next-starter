import fs from 'fs';
import path from 'path';
import { scanObjectEntries, upsertObjectEntry } from './utils/objectEntry.mjs';
import { ACCESS_PRESETS, serializeAccess, syncPresetImport } from './utils/presetAccess.mjs';

// fail-closed 既定（apiAccess 未宣言ドメイン用）。出力は ADMIN_ONLY になる。
const FAIL_CLOSED_ACCESS = ACCESS_PRESETS.ADMIN_ONLY;

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

// サービス登録ファイルに新しいサービスを追記する。
// 値は { service, access } 形式（access は型必須）。access は domain.json の apiAccess を
// プリセット名（一致時）か JSON リテラルで出力し、未宣言の場合は fail-closed（ADMIN_ONLY）を出力する。
// 最後にプリセットの import をファイル内で使われている名前に揃える。
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
    const registered = scanObjectEntries(content.join('\n'), 'serviceRegistry').entries.some((e) => e.key === camel);
    if (registered) {
      // 再生成のたびに警告を繰り返さない（初回登録時に警告済み）
      console.log(`[serviceRegistry] ${camel}: apiAccess 未宣言 → ADMIN_ONLY`);
    } else {
      console.warn(
        `[serviceRegistry] ${camel}: domain.json に apiAccess が無いため fail-closed（ADMIN_ONLY）で登録します。` +
          `公開範囲を変えるには domain.json の apiAccess を宣言して再生成してください。`,
      );
    }
  }
  // serviceRegistry 直下の同一ドメインのエントリ（旧 `${camel}: ${camel}Service,` 形式・複数行整形を含む）を
  // 丸ごと置換 or AUTO-GENERATED-END の直前へ追加
  const updated = upsertObjectEntry(content.join('\n'), {
    objectName: 'serviceRegistry',
    key: camel,
    value: `{ service: ${camel}Service, access: ${serializeAccess(apiAccess)} }`,
  });
  fs.writeFileSync(servicePath, syncPresetImport(updated));
  console.log(`更新しました: ${servicePath}`);
}
