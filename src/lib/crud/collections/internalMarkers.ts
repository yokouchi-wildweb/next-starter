// src/lib/crud/collections/internalMarkers.ts
//
// collections の層の中だけで使う印。公開しない（collections/index.ts からも再公開しない）。

/**
 * 複製の内側の主の create に付ける印（入力の symbol のキー）。
 * 付いた create は minItems の「項目の省略 = [] とみなす」検査を飛ばす（従属は複製の 2 段目で作るため）。
 * symbol のキーは storage binding をそのまま通り、Zod の parse は見ない。集まりの層が外してから base に渡す
 */
export const SKIP_OMITTED_MIN_ITEMS: unique symbol = Symbol("crud.collections.skipOmittedMinItems");
