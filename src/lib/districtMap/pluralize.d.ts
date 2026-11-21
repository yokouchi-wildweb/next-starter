// src/lib/districtMap/pluralize.d.ts
// devDependency pluralize(8.0.0)は型を持たないので、この lib が使う形だけを宣言する(単体の型検査の TS7016 を消す)。
// 使う物を増やしたらここに足す。@types/pluralize を devDependency に入れる時はこのファイルを消す
declare module "pluralize" {
  /** 単数 → 複数(count が 1 以外なら複数形、inclusive で数を前に付ける) */
  function pluralize(word: string, count?: number, inclusive?: boolean): string;
  namespace pluralize {
    function addIrregularRule(single: string, plural: string): void;
    function addUncountableRule(word: string | RegExp): void;
    function addPluralRule(rule: string | RegExp, replacement: string): void;
  }
  export default pluralize;
}
