# scripts/structure/business — 事業の素性が sample のまま本番でビルドしていないかの検査

`pnpm check business`(門 build)。`src/business/business.ts` の `source` が `"sample"` で、段階が本番(`@/lib/appEnv` の `isProduction`)なら exit 1、Tier1(fork_id = next-starter)は警告だけで exit 0。own・開発・staging は通す。判定は `src/lib/business` の `checkBusinessRelease`。直し方と決まり: [src/lib/business/README.md](../../../src/lib/business/README.md)
