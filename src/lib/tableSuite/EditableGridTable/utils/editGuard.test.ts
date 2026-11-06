// src/lib/tableSuite/EditableGridTable/utils/editGuard.test.ts — pnpm test src/lib/tableSuite/EditableGridTable/utils/editGuard.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { createDraftCells, editUnsavedGuard } from "./editGuard";

test("表: 書きかけのセルを数え、数が変わった時だけ知らせる(同じセルの 2 回目は数えない)", () => {
  const counts: number[] = [];
  const cells = createDraftCells((n) => counts.push(n));
  cells.set("1-name", true);
  cells.set("1-name", true);
  cells.set("2-name", true);
  cells.set("1-name", false);
  cells.set("3-name", false);
  cells.set("2-name", false);
  assert.deepEqual(counts, [1, 2, 1, 0]);
});

test("表: 書きかけが 1 つでもあれば「未保存」で守り、無ければ外す。guardUnsaved = false なら守らない", () => {
  assert.deepEqual(editUnsavedGuard({ draftCount: 1, guardUnsaved: true }), { when: true, reason: "unsaved" });
  assert.equal(editUnsavedGuard({ draftCount: 0, guardUnsaved: true }).when, false);
  assert.equal(editUnsavedGuard({ draftCount: 2, guardUnsaved: false }).when, false);
});

// 編集 1 回につき確定 1 回(useEditableCell の handleCommit がこの順で使う)
import { createCommitOnce } from "./commitOnce";

/** handleCommit の骨組み: accepts → (検証が通れば)close → 確定。確定した回数を返す */
const editSession = () => {
  const once = createCommitOnce();
  let commits = 0;
  const commit = ({ keepEditing = false, valid = true } = {}) => {
    if (!once.accepts(keepEditing)) return;
    if (!valid) return; // 検証で止まった = 閉じない
    if (!keepEditing) once.close();
    commits += 1;
  };
  return { once, commit, commits: () => commits };
};

test("表のセル: Enter(確定 → blur)・Tab(blur)・blur のどれで閉じても確定は 1 回", () => {
  const enter = editSession();
  enter.once.open();
  enter.commit(); // Enter の確定
  enter.commit(); // Enter が呼ぶ blur の確定
  assert.equal(enter.commits(), 1);

  const tab = editSession();
  tab.once.open();
  tab.commit(); // Tab でフォーカスが外れた
  assert.equal(tab.commits(), 1);
});

test("表のセル: 検証で止まった確定は閉じず、直して確定できる。編集し直せばまた確定する。keepEditing は何度でも通る", () => {
  const s = editSession();
  s.once.open();
  s.commit({ valid: false });
  s.commit({ valid: false }); // blur でも止まったまま
  s.commit(); // 直して Enter
  s.commit(); // 続く blur
  assert.equal(s.commits(), 1);
  s.once.open(); // 編集し直す
  s.commit();
  assert.equal(s.commits(), 2);
  s.commit({ keepEditing: true });
  s.commit({ keepEditing: true });
  assert.equal(s.commits(), 4);
});
