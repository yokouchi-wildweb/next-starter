# scripts/structure/legal — 法務の文書が例文(sample)のまま本番でビルドしていないかの検査

`pnpm check legal`(門 build)。`src/config/features/legal.config.ts` の `documents.<kind>` が `{ source: "sample" }`(省略も同じ、上流の例文を表示)の文書が 1 つでもあり、段階が本番(`@/lib/appEnv` の `isProduction`)なら exit 1、Tier1(fork_id = next-starter)は警告だけで exit 0。全部 own・開発・staging は通す。判定は `src/features/core/legal` の `checkLegalRelease`(事業の素性の検査と同じ部品 `@/lib/business` の `sampleReleaseLevel`)。直し方と決まり: [src/features/core/legal/README.md](../../../src/features/core/legal/README.md)
