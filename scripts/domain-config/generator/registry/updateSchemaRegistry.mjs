import fs from 'fs';
import path from 'path';

// スキーマのレジストリにエクスポートを追加
export default function updateSchemaRegistry({ rootDir, camel, dbEngine }) {
  // Firestore ドメインではスキーマは不要なのでスキップ
  if (dbEngine === 'Firestore') {
    console.log(`Firestore ドメインのためスキーマ登録をスキップしました: ${camel}`);
    return;
  }
  const schemaPath = path.join(rootDir, 'src', 'registry', 'schemaRegistry.ts');
  // レジストリが無ければ何もしない
  if (!fs.existsSync(schemaPath)) return;
  const lines = fs.readFileSync(schemaPath, 'utf8').split(/\r?\n/);
  const marker = lines.findIndex((l) => l.includes('// --- AUTO-GENERATED-END ---'));
  const exportIndex = marker !== -1 ? marker : lines.findIndex((l) => l.trim() === 'export {};');
  const newLine = `export * from "@/features/${camel}/entities/drizzle";`;
  // 既に登録済みなら処理しない
  if (lines.includes(newLine)) {
    console.log(`スキップしました（既に存在）: ${schemaPath}`);
    return;
  }
  lines.splice(exportIndex, 0, newLine);
  fs.writeFileSync(schemaPath, lines.join('\n'));
  console.log(`更新しました: ${schemaPath}`);
}
