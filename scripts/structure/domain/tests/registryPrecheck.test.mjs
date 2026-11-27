// 登録表（serviceRegistry.ts）の書く前の検査: これから書くサービス・<登録名>Base.ts を重ねた見え方で検査し、作れなければ何も書かない。
// 実行: pnpm test scripts/structure/domain/tests/registryPrecheck.test.mjs
import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { GENERATED_HEADER, createOverlayView, discoverRegistrations } from "../../registry/serviceRegistry/discover.mjs";
import { createWorkspace } from "../domain/workspace.mjs";
import { applyOutputs } from "../pipeline/apply.mjs";
import { overlayFromOutputs, precheckServiceRegistry } from "../pipeline/serviceRegistry.mjs";
import { file, writeOnce } from "../render/output.mjs";
import { makeProject, removeAll } from "./helpers.mjs";

const cleanup = [];
after(() => removeAll(cleanup));

const API_ACCESS = { read: "public", write: { roleCategories: ["admin"] } };

/** 登録表が空の最小リポ + foo（宣言だけ） */
function project() {
  const root = makeProject({ configs: { foo: { singular: "foo", plural: "foos", dbEngine: "Neon", apiAccess: API_ACCESS } }, cleanup });
  fs.mkdirSync(path.join(root, "src", "registry"), { recursive: true });
  fs.writeFileSync(path.join(root, "src", "registry", "serviceRegistry.ts"), `${GENERATED_HEADER}\nexport const serviceRegistry: DomainRegistry = {\n};\n`);
  return root;
}

function plannedOutputs(root) {
  const serverDir = path.join(root, "src", "domains", "foo", "services", "server");
  return [file(path.join(serverDir, "fooBase.ts"), "// base\n"), writeOnce(path.join(serverDir, "fooService.ts"), "// service\n")];
}

/** foo の登録のサービスのファイルが無いという誤り */
const MISSING_SERVICE = /src\/domains\/foo\/entities\/foo\/entity\.json: サービスのファイル src\/domains\/foo\/services\/server\/fooService\.ts が無い/;

test("重ねた見え方: これから書くサービスのファイルが見え、ディスクには何も無い", () => {
  const root = project();
  const workspace = createWorkspace(root);
  const overlay = overlayFromOutputs(plannedOutputs(root), workspace);
  const { rows, errors } = discoverRegistrations(root, createOverlayView(overlay));
  assert.deepEqual(errors, []);
  assert.deepEqual(rows.map((row) => row.key), ["foo"]);
  assert.equal(rows[0].table, "foos");
  assert.equal(fs.existsSync(path.join(root, "src", "domains", "foo", "services", "server")), false);
  // ディスクだけの見え方では、まだ無いサービスのファイルを誤りとして出す
  assert.ok(discoverRegistrations(root).errors.some((error) => MISSING_SERVICE.test(error)));
  // 既存ファイルがある writeOnce は重ねない（既存が残るので見え方も既存）
  fs.mkdirSync(path.join(root, "src", "domains", "foo", "services", "server"), { recursive: true });
  fs.writeFileSync(path.join(root, "src", "domains", "foo", "services", "server", "fooService.ts"), "// hand\n");
  assert.equal(overlayFromOutputs(plannedOutputs(root), workspace).has(path.join(root, "src", "domains", "foo", "services", "server", "fooService.ts")), false);
});

test("作れる状態なら通り、書いた後に pnpm generate registry が同じ結論になる", () => {
  const root = project();
  const workspace = createWorkspace(root);
  const outputs = plannedOutputs(root);
  assert.doesNotThrow(() => precheckServiceRegistry(workspace, outputs));
  applyOutputs(outputs, { log: () => {}, warn: () => {} });
  const { rows, errors } = discoverRegistrations(root);
  assert.deepEqual(errors, []);
  assert.deepEqual(rows.map((row) => row.key), ["foo"]);
});

test("他のドメインに base があるのに登録が無ければ、書く前に止まり何も書かない", () => {
  const root = project();
  const workspace = createWorkspace(root);
  const barServer = path.join(root, "src", "domains", "bar", "services", "server");
  fs.mkdirSync(barServer, { recursive: true });
  fs.writeFileSync(path.join(barServer, "barBase.ts"), "// bar base\nexport const barBase = createCrudService(BarTable, {});\n");
  assert.throws(() => precheckServiceRegistry(workspace, plannedOutputs(root), { errorPrefix: "✗ " }), (err) => {
    assert.match(err.message, /^✗ src\/registry\/serviceRegistry\.ts を生成できません:\n/);
    assert.match(err.message, /src\/domains\/bar\/services\/server\/barBase\.ts の登録\(entities\/bar\/entity\.json\)が無い/);
    assert.doesNotMatch(err.message, MISSING_SERVICE, "これから書く foo のサービスは見えている");
    return true;
  });
  assert.equal(fs.existsSync(path.join(root, "src", "domains", "foo", "services", "server")), false, "何も書かれていない");
});
