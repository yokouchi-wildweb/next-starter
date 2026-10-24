// serverOnlyStub.test.mts 用: `import "server-only"` を持つ server コードの代わり。
// package.json に "type": "module" が無いため、tsx はこのファイルを CJS（require("server-only")）として読む。
import "server-only";

export const loaded = true;
