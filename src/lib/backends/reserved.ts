// src/lib/backends/reserved.ts
// 予約の実装の名前(D20 D29)。選ぶ点の項目の名前に使えず、検査がこの定数を読む

/** 組み込みの「使わない」。点が optional を宣言した口だけ選択表に書ける */
export const NONE_IMPLEMENTATION = "none";

/** テストの偽物。選択表では選べない(書けばどの段でも止める)。テストは口の持ち主の差し替え口で入れる */
export const FAKE_IMPLEMENTATION = "fake";

/** 予約の名前の全部 */
export const RESERVED_IMPLEMENTATION_NAMES: readonly string[] = [NONE_IMPLEMENTATION, FAKE_IMPLEMENTATION];

/** 選択表に書けない名前 */
export const UNSELECTABLE_IMPLEMENTATION_NAMES: readonly string[] = [FAKE_IMPLEMENTATION];
