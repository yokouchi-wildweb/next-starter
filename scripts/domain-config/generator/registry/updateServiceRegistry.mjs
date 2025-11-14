import fs from 'fs';
import path from 'path';

// サービス登録ファイルに新しいサービスを追記する
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
  const registryLine = `  ${camel}: ${camel}Service,`;
  // まだ登録されていなければレジストリに追加
  if (!content.includes(registryLine)) {
    content.splice(closingIndex, 0, registryLine);
  }
  fs.writeFileSync(servicePath, content.join('\n'));
  console.log(`更新しました: ${servicePath}`);
}
