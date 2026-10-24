// tsx で動かすテスト用の preload: `server-only` を空モジュールに解決する。
// 使い方: `npx tsx --import ./scripts/test/serverOnlyStub.mjs --test <file>`
//
// 背景: `import "server-only"` は Next のバンドラーだけが解決するガードで、package.json に依存は無い。
// テストが serviceRegistry などから server コードへ import をたどると、素の tsx では
// ERR_MODULE_NOT_FOUND で全件落ちる。本物の server-only パッケージを入れても react-server 条件以外では
// import 時に throw するため解決にならない。ここではテスト実行時だけ解決先を差し替え、ソース側のガードは残す。
//
// registerHooks（同期フック）を使うのは、package.json に "type": "module" が無く .ts が CJS の require でも
// 読まれるため。非同期の register() は import にしか効かない。
//
// さらに Module._resolveFilename も包む。--experimental-test-module-mocks を付けると CJS の require が
// テストランナーの mock ローダー経由になり、registerHooks の resolve を通らずに元の _resolveFilename へ届くため。
// この preload は tsx の登録より後に読まれるので、ここで包めば一番外側になり mock ローダー経由も拾える。
// pnpm task（scripts/tasks/run.ts）も同じ理由でこの preload を読む。
import Module, { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";

// CJS の require は data: URL を読めないため、実ファイルの空モジュールを返す
const STUB_URL = new URL("./serverOnlyEmpty.cjs", import.meta.url).href;
const STUB_PATH = fileURLToPath(STUB_URL);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: STUB_URL, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveFilenameWithServerOnlyStub(request, ...rest) {
  if (request === "server-only") return STUB_PATH;
  return originalResolveFilename.call(this, request, ...rest);
};
