// storagePurposeRegistry.ts の文字列への反映。AUTO ブロックの中だけを書き換え、外（CORE の展開・FORK）は触らない

import { removeObjectEntry, scanObjectEntries, upsertObjectEntry } from "../../../text/objectEntry.mjs";

const OBJECT_NAME = "storagePurposeRegistry";
const START_MARKER = "// --- AUTO-GENERATED-START ---";
const END_MARKER = "// --- AUTO-GENERATED-END ---";
const CONFIG_IMPORT = 'import { STORAGE_CONFIG } from "@/config/app/storage.config";';

function isInsideAutoBlock(text, index) {
  const start = text.indexOf(START_MARKER);
  const end = text.indexOf(END_MARKER);
  return start !== -1 && end !== -1 && index > start && index < end;
}

/** 本文で STORAGE_CONFIG を使っているかに import を合わせる */
export function syncStorageConfigImport(text) {
  const withoutImport = text
    .split("\n")
    .filter((line) => line.trim() !== CONFIG_IMPORT)
    .join("\n");
  const used = /\bSTORAGE_CONFIG\./.test(withoutImport);
  const hasImport = text.split("\n").some((line) => line.trim() === CONFIG_IMPORT);
  if (used === hasImport) return text;
  if (!used) return withoutImport;
  const lines = text.split("\n");
  let lastImport = -1;
  lines.forEach((line, i) => {
    if (line.startsWith("import ")) lastImport = i;
  });
  lines.splice(lastImport + 1, 0, CONFIG_IMPORT);
  return lines.join("\n");
}

/** AUTO ブロック内の `<camel>.*` のうち、keep に無いものを消す */
function removeStaleEntries(text, camel, keep) {
  let next = text;
  for (;;) {
    const stale = scanObjectEntries(next, OBJECT_NAME).entries.find(
      (entry) => entry.key.startsWith(`${camel}.`) && !keep.has(entry.key) && isInsideAutoBlock(next, entry.start),
    );
    if (!stale) break;
    next = removeObjectEntry(next, { objectName: OBJECT_NAME, key: stale.key }).text;
  }
  return next;
}

/**
 * 登録表の文字列に、1 ドメイン分の用途を反映する（AUTO ブロックの upsert と、消えた項目の削除）。
 * @returns {{ text: string, skipped: string[] }} skipped = AUTO 外に同じ ID があり上書きしなかった ID
 */
export function applyStoragePurposeEntries(text, { camel, entries }) {
  let next = removeStaleEntries(text, camel, new Set(entries.map((e) => e.id)));
  const skipped = [];
  for (const { id, value } of entries) {
    const existing = scanObjectEntries(next, OBJECT_NAME).entries.find((e) => e.key === id);
    if (existing && !isInsideAutoBlock(next, existing.start)) {
      skipped.push(id);
      continue;
    }
    next = upsertObjectEntry(next, { objectName: OBJECT_NAME, key: id, keyLiteral: JSON.stringify(id), value });
  }
  return { text: syncStorageConfigImport(next), skipped };
}

/** 登録表から 1 ドメイン分の AUTO エントリを消す（dc:delete）。AUTO 外のエントリは残す */
export function removeStoragePurposeEntries(text, { camel }) {
  return syncStorageConfigImport(removeStaleEntries(text, camel, new Set()));
}
