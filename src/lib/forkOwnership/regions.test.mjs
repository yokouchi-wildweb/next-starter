// fork の区画の印の形を固定する検査(pnpm test:fork-regions)
// - 受け口の一覧(intake.txt)で region に当たる全ファイル(src/registry・room と seed の登録点)で、
//   印の対が閉じている・入れ子が無い・文言が正しい
// - 古い下流の印(DOWNSTREAM / 上流は空。下流が追記 / FORK (手書き))が残っていない
//   fork でも失敗する: 古い印の下の行は新しい印の対の中へ移す(.notices の registry-fork-markers)
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { matchIntake, parseIntake } from "./intake.mjs";
import { FORK_REGION_END, FORK_REGION_START, isInForkRegion, parseForkRegions } from "./regions.mjs";

const ROOT = resolve(import.meta.dirname, "../../..");

/** intake.txt で kind が region のファイル(git の管理下にある物) */
const listRegionFiles = () => {
  const { rules } = parseIntake(readFileSync(join(ROOT, "src/lib/forkOwnership/intake.txt"), "utf8"));
  return execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    .filter((path) => path !== "" && matchIntake(rules, path)?.kind === "region")
    .map((path) => join(ROOT, path));
};

describe("受け口の一覧で region のファイル", () => {
  const files = listRegionFiles();

  test("src/registry と room・seed の登録点が対象に入っている", () => {
    const paths = files.map((file) => relative(ROOT, file));
    for (const expected of ["src/registry/coinIssuanceRegistry.ts", "servers/room/src/registry.ts", "scripts/db/seed/data/registry.ts"]) {
      assert.ok(paths.includes(expected), expected);
    }
  });

  test("印の対が閉じていて、入れ子・文言の違いが無い", () => {
    const problems = files.flatMap((file) =>
      parseForkRegions(readFileSync(file, "utf8")).errors.map(
        ({ line, message }) => `${relative(ROOT, file)}:${line} ${message}`,
      ),
    );
    assert.deepEqual(problems, [], `fork の区画の印を直す:\n${problems.join("\n")}`);
  });

  test("古い下流の印が残っていない", () => {
    const legacy = files.flatMap((file) =>
      parseForkRegions(readFileSync(file, "utf8"))
        .regions.filter((region) => region.legacy)
        .map(({ start }) => `${relative(ROOT, file)}:${start}`),
    );
    assert.deepEqual(
      legacy,
      [],
      `古い印を新しい対に置き換え、その下に書いた行を対の中へ移す(開始 \`${FORK_REGION_START}\` / 終了 \`${FORK_REGION_END}\`):\n${legacy.join("\n")}`,
    );
  });

  test("少なくとも 1 つの registry に区画がある(検査の対象を取り違えていない)", () => {
    const count = files.reduce((sum, file) => sum + parseForkRegions(readFileSync(file, "utf8")).regions.length, 0);
    assert.ok(count > 0);
  });
});

describe("parseForkRegions", () => {
  const S = FORK_REGION_START;
  const E = FORK_REGION_END;

  test("対の区画を読み、中の行だけを区画の中とする", () => {
    const text = ["export const a = [", "  upstream,", `  ${S}`, "  forkEntry,", `  ${E}`, "];"].join("\n");
    const { regions, errors } = parseForkRegions(text);
    assert.deepEqual(errors, []);
    assert.deepEqual(regions, [{ start: 3, end: 5, legacy: false }]);
    assert.equal(isInForkRegion(regions, 4), true);
    assert.equal(isInForkRegion(regions, 2), false);
    assert.equal(isInForkRegion(regions, 3), false);
  });

  test("1 ファイルに複数の対を置ける", () => {
    const text = [S, 'import { x } from "./x";', E, "", "export const a = [", `  ${S}`, "  x,", `  ${E}`, "];"].join("\n");
    assert.equal(parseForkRegions(text).regions.length, 2);
  });

  test("終了の無い開始・開始の無い終了・入れ子は失敗", () => {
    assert.match(parseForkRegions([S, "x"].join("\n")).errors[0].message, /終了の印の無い/);
    assert.match(parseForkRegions(["x", E].join("\n")).errors[0].message, /開始の印の無い/);
    assert.match(parseForkRegions([S, S, E].join("\n")).errors[0].message, /入れ子/);
  });

  test("文言の違う印は失敗", () => {
    const { errors } = parseForkRegions("// --- fork entries begin ---");
    assert.match(errors[0].message, /文言が違う/);
  });

  test("古い印 3 通りを読み、閉じ括弧までを区画にする", () => {
    for (const marker of [
      "// --- DOWNSTREAM (downstream で追加) ---",
      "// --- ここに計測対象を登録する（上流は空。下流が追記） ---",
      "// --- FORK (手書き) ---",
    ]) {
      const text = ["export const a = {", `  ${marker}`, "  forkEntry: 1,", "};"].join("\n");
      const { regions, errors } = parseForkRegions(text);
      assert.deepEqual(errors, [], marker);
      assert.deepEqual(regions, [{ start: 2, end: 4, legacy: true }], marker);
      assert.equal(isInForkRegion(regions, 3), true, marker);
    }
  });

  test("生成器の印は区画として読まない", () => {
    const text = ["// --- AUTO-GENERATED-START ---", "x", "// --- AUTO-GENERATED-END ---"].join("\n");
    assert.deepEqual(parseForkRegions(text), { regions: [], errors: [] });
  });
});
