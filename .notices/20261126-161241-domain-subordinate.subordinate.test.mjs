// .notices/20261126-161241-domain-subordinate.subordinate.mjs の検査(鍵の改名・従属のドメインを主の中へ移す計画・止める場合)。一時のリポで確かめる。
// 実行: pnpm test .notices/20261126-161241-domain-subordinate.subordinate.test.mjs
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";

import { applySubordinate, planSubordinate, renameCollectionKey, rewriteReader, rewriteRule, seedHasRows } from "./20261126-161241-domain-subordinate.subordinate.mjs";

const roots = [];
after(() => {
  for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
});

const owner = { singular: "album", plural: "albums", fields: [{ name: "photos", fieldType: "mediaCollection", collection: { domain: "album_photo", maxItems: 5 } }] };
const child = { singular: "album_photo", plural: "album_photos", relations: [{ domain: "album", relationType: "belongsTo", required: true, onDelete: "CASCADE" }] };
const EMPTY_SEED = 'export const seed = defineSeed({\n  tables: {\n    album_photos: [\n      // 例\n    ],\n  },\n});\n';

/** 一時のリポ(git の追跡あり): ファイルの道 → 中身 */
function repo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "subordinate-"));
  roots.push(root);
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), typeof text === "string" ? text : JSON.stringify(text, null, 2));
  }
  execFileSync("git", ["init", "-q"], { cwd: root });
  return root;
}
const domain = (name, entity) => ({ [`src/domains/${name}/domain.json`]: { domainConfigVersion: "2.0", label: name }, [`src/domains/${name}/entities/${name}/entity.json`]: entity });

test("鍵の改名: collection の中の domain だけを registration に(relations の domain は触らない)", () => {
  const text = JSON.stringify({ relations: [{ domain: "x" }], fields: [{ collection: { domain: "a_b", maxItems: 2 } }] }, null, 2);
  const renamed = renameCollectionKey(text);
  assert.match(renamed, /"registration": "a_b"/);
  assert.match(renamed, /"relations": \[\n\s+\{\n\s+"domain": "x"/);
  assert.equal(renameCollectionKey(renamed), renamed);
});

test("seed の行: 空の配列(注釈だけ)は行なし、要素があれば行あり", () => {
  assert.equal(seedHasRows(EMPTY_SEED), false);
  assert.equal(seedHasRows(EMPTY_SEED.replace("// 例", '{ $key: "a", file: "x" }')), true);
});

test("読み手と門番の規則の書き換え: 道は続きが / か引用符の時だけ、規則は従属の行を外し主が無ければ problem", () => {
  assert.equal(rewriteReader('import x from "@/domains/albumPhoto/a";\n// src/domains/albumPhoto/b.ts\n"@/domains/albumPhotoX/c"', "albumPhoto", "album"), 'import x from "@/domains/album/a";\n// src/domains/album/b.ts\n"@/domains/albumPhotoX/c"');
  const rule = 'domains: [\n    "album",\n    "albumPhoto",\n  ],';
  assert.deepEqual(rewriteRule(rule, "albumPhoto", "album"), { text: 'domains: [\n    "album",\n  ],', changed: true, problem: null });
  assert.match(rewriteRule('domains: [\n    "albumPhoto",\n  ],', "albumPhoto", "album").problem, /主のドメイン album を開けない/);
});

test("移す: 従属の登録と一式を主の中へ、domain.json・集める入口・空の seed は消し、読み手と規則を書き換える。2 回目は何も出ない", () => {
  const root = repo({
    ...domain("album", owner),
    ...domain("albumPhoto", child),
    "src/domains/albumPhoto/entities/drizzle.ts": 'export * from "./albumPhoto/drizzle";\n',
    "src/domains/albumPhoto/entities/albumPhoto/drizzle.ts": "// src/domains/albumPhoto/entities/albumPhoto/drizzle.ts\nexport const AlbumPhotoTable = 1;\n",
    "src/domains/albumPhoto/services/server/albumPhotoService.ts": 'import { albumPhotoBase } from "./albumPhotoBase";\nexport const albumPhotoService = albumPhotoBase;\n',
    "src/domains/albumPhoto/seed.ts": EMPTY_SEED,
    "src/domains/album/services/server/albumCollections.ts": 'import { AlbumPhotoTable } from "@/domains/albumPhoto/entities/drizzle";\n',
    "src/featureGate/rules/albumDomain.ts": 'export const rule = { domains: [\n    "album",\n    "albumPhoto",\n  ] };\n',
  });
  const plan = planSubordinate(root);
  assert.deepEqual(plan.stops, []);
  assert.deepEqual(plan.keyRenames, ["src/domains/album/entities/album/entity.json"]);
  assert.deepEqual(plan.moves.map((m) => m.to).sort(), [
    "src/domains/album/entities/albumPhoto/drizzle.ts",
    "src/domains/album/entities/albumPhoto/entity.json",
    "src/domains/album/services/server/albumPhotoService.ts",
  ]);
  applySubordinate(root, plan);
  const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
  assert.equal(fs.existsSync(path.join(root, "src/domains/albumPhoto")), false);
  assert.match(read("src/domains/album/entities/album/entity.json"), /"registration": "album_photo"/);
  assert.match(read("src/domains/album/entities/albumPhoto/drizzle.ts"), /^\/\/ src\/domains\/album\/entities\/albumPhoto\/drizzle\.ts/);
  assert.match(read("src/domains/album/services/server/albumCollections.ts"), /from "@\/domains\/album\/entities\/drizzle"/);
  assert.doesNotMatch(read("src/featureGate/rules/albumDomain.ts"), /albumPhoto/);
  const again = planSubordinate(root);
  assert.deepEqual([again.keyRenames, again.moves, again.removes, Object.keys(again.writes), again.stops], [[], [], [], [], []]);
});

test("止める: seed に行がある・移す先に違う中身がある・従属でない登録がある・2 つの主が指す", () => {
  const withRows = repo({ ...domain("album", owner), ...domain("albumPhoto", child), "src/domains/albumPhoto/seed.ts": EMPTY_SEED.replace("// 例", '{ $key: "a" }') });
  assert.match(planSubordinate(withRows).stops.join("\n"), /seed\.ts: 行がある/);

  const clash = repo({ ...domain("album", owner), ...domain("albumPhoto", child), "src/domains/albumPhoto/x.ts": "a\n", "src/domains/album/x.ts": "b\n" });
  assert.match(planSubordinate(clash).stops.join("\n"), /移す先に違う中身のファイルがある/);

  const extra = repo({ ...domain("album", owner), ...domain("albumPhoto", child), "src/domains/albumPhoto/entities/other/entity.json": { singular: "other" } });
  assert.match(planSubordinate(extra).stops.join("\n"), /従属でない登録\(other\)/);

  const book = { ...owner, singular: "book", plural: "books" };
  const twoOwners = repo({ ...domain("album", owner), ...domain("book", book), ...domain("albumPhoto", child) });
  assert.match(planSubordinate(twoOwners).stops.join("\n"), /2 つの主\(album, book\)/);
});
