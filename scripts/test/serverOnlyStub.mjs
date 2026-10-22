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
import { registerHooks } from "node:module";

// CJS の require は data: URL を読めないため、実ファイルの空モジュールを返す
const STUB_URL = new URL("./serverOnlyEmpty.cjs", import.meta.url).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: STUB_URL, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
