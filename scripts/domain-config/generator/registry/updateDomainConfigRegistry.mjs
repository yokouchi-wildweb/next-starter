import fs from 'fs';
import path from 'path';
import { toSnakeCase } from '../../../../src/utils/stringCase.mjs';

// ドメイン設定レジストリに新しいドメインを追記する
export default function updateDomainConfigRegistry({ rootDir, camel }) {
  const registryPath = path.join(rootDir, 'src', 'registry', 'domainConfigRegistry.ts');
  // レジストリが無ければ何もしない
  if (!fs.existsSync(registryPath)) return;

  const content = fs.readFileSync(registryPath, 'utf8').split(/\r?\n/);
  const snake = toSnakeCase(camel);

  const importLine = `import ${camel}Config from "@/features/${camel}/domain.json";`;
  const mapEntry = `  ${snake}: ${camel}Config,`;

  // 最後の import 行を探す
  let lastImport = -1;
  for (let i = 0; i < content.length; i++) {
    if (content[i].startsWith('import')) lastImport = i;
  }

  // 未登録であれば import 行を挿入
  if (!content.includes(importLine)) {
    content.splice(lastImport + 1, 0, importLine);
  }

  // AUTO-GENERATED-END マーカーを探す
  const registryEndMarker = content.findIndex((l) => l.includes('// --- AUTO-GENERATED-END ---'));
  let insertIndex = registryEndMarker;
  if (insertIndex === -1) {
    // マーカーがない場合は } as const; の手前を探す
    insertIndex = content.findIndex((l) => l.trim().startsWith('} as const'));
  }

  // まだ登録されていなければマップに追加
  if (!content.some((l) => l.includes(`${snake}: ${camel}Config`))) {
    content.splice(insertIndex, 0, mapEntry);
  }

  fs.writeFileSync(registryPath, content.join('\n'));
  console.log(`更新しました: ${registryPath}`);
}
