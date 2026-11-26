# scripts/structure/business — 事業の素性が sample のまま本番でビルドしていないかの検査

## Overview

- `pnpm check business`(build のときに回る検査の束 = 段階 build の 1 つ)
- `src/business/business.ts` の `source` が `"sample"` で、段階が本番(`@/lib/appEnv` の `isProduction`)なら exit 1
- Tier1(`repo.json` の `repo_id` が `src/lib/CATALOG.md` の先頭の節 = next-starter)は警告だけで exit 0。`source` が `"own"`(fork が自分の値を書いた)・開発・staging は通す
- repo の名前の宣言(`repo.json`)に誤りがあれば exit 2(黙って Tier1 でないとは見ない。読み手 `src/lib/forkOwnership` の `readTier1`)
- 判定は `src/lib/business` の `checkBusinessRelease`

## Related

- 直し方と決まり: [src/lib/business/README.md](../../../src/lib/business/README.md)
