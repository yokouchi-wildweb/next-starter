# scripts/structure/legal — 法務の文書が例文(sample)のまま本番でビルドしていないかの検査

## Overview

- 法務の文書(利用規約など)が上流の例文のまま本番でビルドされるのを止める検査
- 判定は `src/domains/core/legal` の `checkLegalRelease`(事業の素性の検査と同じ部品 `@/lib/business` の `sampleReleaseLevel`)

## Usage

```bash
pnpm check legal        # 段階 build
```

- 直し方と決まり: `src/domains/core/legal/README.md`

## Internals

- 見る物: `src/config/domains/legal.config.ts` の `documents.<kind>`。`{ source: "sample" }`(省略も同じ、上流の例文を表示)の文書が 1 つでもあれば例文のまま
- 段階が本番(`@/lib/appEnv` の `isProduction`)で例文のままなら exit 1。Tier1(`repo.json` の `repo_id` が `src/lib/CATALOG.md` の先頭の節。読み手は `readTier1`)は警告だけで exit 0
- repo の名前の宣言(`repo.json`)に誤りがあれば exit 2(黙って Tier1 でないとは見ない。読み手 `src/lib/forkOwnership` の `readTier1`)
- 全部 own・開発・staging は通す

## Related

- 法務のドメイン: `src/domains/core/legal/README.md`
