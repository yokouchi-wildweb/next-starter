// .notices/20261126-185544-firestore-registration.firestore.mjs の検査(Firestore の登録の表のファイルを登録のフォルダへ移す・名前を変える・止める場合)。
// 実行: pnpm test .notices/20261126-185544-firestore-registration.firestore.test.mjs
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";

import { applyFirestore, planFirestore, renameExport, rewriteReader } from "./20261126-185544-firestore-registration.firestore.mjs";

const roots = [];
after(() => {
  for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
});

function repo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "firestore-move-"));
  roots.push(root);
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), typeof text === "string" ? text : JSON.stringify(text));
  }
  execFileSync("git", ["init", "-q"], { cwd: root });
  return root;
}
const room = (extra = {}) => ({
  "src/domains/room/domain.json": { domainConfigVersion: "2.0", label: "部屋" },
  "src/domains/room/entities/room/entity.json": { singular: "room", plural: "rooms", dbEngine: "Firestore" },
  "src/domains/room/entities/firestore.ts": '// src/domains/room/entities/firestore.ts\n\nexport const collectionPath = "rooms";\n',
  "src/domains/room/entities/model.ts": '// src/domains/room/entities/model.ts\nimport type { Note } from "./note";\nexport type Room = { id: string; note?: Note };\n',
  "src/domains/room/entities/note.ts": "export type Note = string;\n",
  ...extra,
});

test("名前と読み手: export を <登録名>CollectionPath に、import の要素と参照を変え、プロパティ名と別の束縛は触らない", () => {
  assert.equal(renameExport('export const collectionPath = "rooms";\n', "room"), 'export const roomCollectionPath = "rooms";\n');
  const modules = new Set(["src/domains/room/entities/firestore", "src/domains/room/entities"]);
  const text = 'import { collectionPath } from "@/domains/room/entities/firestore";\nconst a = { collectionPath, other: x.collectionPath };\nuse(collectionPath);\n';
  const { text: out, stop } = rewriteReader("/nowhere", "src/a.ts", text, modules, "roomCollectionPath");
  assert.equal(stop, null);
  assert.equal(out, 'import { roomCollectionPath } from "@/domains/room/entities/firestore";\nconst a = { collectionPath: roomCollectionPath, other: x.collectionPath };\nuse(roomCollectionPath);\n');
  assert.match(rewriteReader("/nowhere", "src/b.ts", 'import { collectionPath as p } from "@/domains/room/entities";\n', modules, "roomCollectionPath").stop, /別名/);
  assert.equal(rewriteReader("/nowhere", "src/c.ts", 'import { collectionPath } from "@/domains/other/entities";\n', modules, "roomCollectionPath").stop, null);
});

test("移す: 直下の表のファイルを登録のフォルダへ(相対の import は 1 段深く、頭の道も)、読み手を書き換え、2 回目は何も出ない", () => {
  const root = repo(room({ "src/domains/room/services/client/roomClient.ts": 'import { collectionPath } from "@/domains/room/entities/firestore";\nexport const path = collectionPath;\n' }));
  const plan = planFirestore(root);
  assert.deepEqual(plan.stops, []);
  assert.deepEqual(plan.moves.map((m) => m.to).sort(), ["src/domains/room/entities/room/firestore.ts", "src/domains/room/entities/room/model.ts"]);
  applyFirestore(root, plan);
  const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
  assert.match(read("src/domains/room/entities/room/firestore.ts"), /^\/\/ src\/domains\/room\/entities\/room\/firestore\.ts\n\nexport const roomCollectionPath = "rooms";/);
  assert.match(read("src/domains/room/entities/room/model.ts"), /from "\.\.\/note"/);
  assert.match(read("src/domains/room/services/client/roomClient.ts"), /import \{ roomCollectionPath \}[\s\S]*= roomCollectionPath;/);
  assert.deepEqual([planFirestore(root).moves, planFirestore(root).stops], [[], []]);
});

test("止める: Firestore の登録が 2 つあるドメインの直下のファイル", () => {
  const root = repo(room({ "src/domains/room/entities/roomNote/entity.json": { singular: "room_note", plural: "room_notes", dbEngine: "Firestore" } }));
  assert.match(planFirestore(root).stops.join("\n"), /Firestore の登録が 2 つ/);
});
