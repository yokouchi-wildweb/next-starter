// src/components/Input/AsyncOptionSource/types.ts
//
// 非同期の選択肢の取得で、部品が searchFn を呼ぶときの形(引数と結果)。部品の側が持つ形で、データの lib(crud)の型は読まない
// (crud は表の部品を通してこの棚を読むので、型でも読むと単位の輪になる。D232)。
// crud の client.search(params: SearchParams)はこの形を受けるのでそのまま渡せる(SearchParams はこの形を含む)。

/** 関連度ランキングで重みを付ける列(列名、または列名と重み) */
export type AsyncSearchRankField = string | { field: string; weight?: number };

/** 関連度ランキングの指定(fields を省くと searchFields を等重みで使う) */
export type AsyncSearchRankSpec = {
  fields?: AsyncSearchRankField[];
};

/** 部品が searchFn に渡す引数 */
export type AsyncSearchParams = {
  page?: number;
  limit?: number;
  searchQuery?: string;
  searchFields?: string[];
  /** true = サービスの既定のランキング、指定 = 呼び出しごとの重み、無し / false = ランキングなし */
  searchRank?: boolean | AsyncSearchRankSpec;
};

/** searchFn が返す 1 ページ分 */
export type AsyncSearchResult<T> = {
  results: T[];
  total: number;
};
