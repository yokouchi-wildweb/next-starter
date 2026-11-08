// src/lib/defineConfig/types.ts
//
// defineConfig の型。値の検査は Standard Schema(https://standardschema.dev の v1)で受ける。
// zod には依存しない: 仕様の型の要る所だけをここに写す(zod 3.25 の schema はこの形にそのまま当たる)。

/** Standard Schema v1 の検査の問題 1 件 */
export interface StandardSchemaIssue {
  readonly message: string;
  readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }> | undefined;
}

/** Standard Schema v1 の検査の結果 */
export type StandardSchemaResult<Output> =
  | { readonly value: Output; readonly issues?: undefined }
  | { readonly issues: ReadonlyArray<StandardSchemaIssue> };

/** Standard Schema v1(`~standard` を持つ検査器。zod・valibot・arktype などが実装する) */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (value: unknown) => StandardSchemaResult<Output> | Promise<StandardSchemaResult<Output>>;
    readonly types?: { readonly input: Input; readonly output: Output } | undefined;
  };
}

type AnyFunction = (...args: any[]) => unknown;

/** 中へ深く合成する値(配列・関数・Date などは丸ごと置き換える) */
type IsMergeable<V> = V extends ReadonlyArray<unknown>
  ? false
  : V extends AnyFunction
    ? false
    : V extends Date | RegExp | Map<unknown, unknown> | Set<unknown>
      ? false
      : V extends object
        ? true
        : false;

/** 配列の項目のうち、id に使えるキー(値が string か number) */
export type IdKeyOf<T> = {
  [K in keyof T]-?: NonNullable<T[K]> extends string | number ? K : never;
}[keyof T] &
  string;

/** 配列 1 つの扱い: replace = 丸ごと置き換え(既定) | append = 既定の後ろに足す | { by } = id で合わせる */
export type ArrayRule<T> = "replace" | "append" | { readonly by: IdKeyOf<T> };

/** 既定の形をなぞる配列の規則(配列のキーには ArrayRule、入れ子のオブジェクトにはその中の規則) */
export type ArrayRules<D> = {
  readonly [K in keyof D]?: NonNullable<D[K]> extends ReadonlyArray<infer T>
    ? ArrayRule<T>
    : IsMergeable<NonNullable<D[K]>> extends true
      ? ArrayRules<NonNullable<D[K]>>
      : never;
};

/** defineConfig の第 2 引数 */
export interface ConfigRules<D> {
  /** 誤りの文の頭に付ける名前(例 "toast") */
  readonly label?: string;
  /** 配列の扱い。書かない配列は replace */
  readonly arrays?: ArrayRules<D>;
  /** 合成した値の検査(Standard Schema)。検査だけで、その出力は使わない */
  readonly schema?: StandardSchemaV1;
}

/** 省略できるキー(null で消せるキー) */
type OptionalKeys<D> = { [K in keyof D]-?: object extends Pick<D, K> ? K : never }[keyof D];

/** mergeById の配列の上書きの項目: id は必須、他は部分、$delete: true で既定の項目を消す */
export type ByIdItem<T, K extends keyof T> = Partial<T> & Pick<T, K> & { readonly $delete?: true };

type ArrayOverride<T, A> = A extends { readonly by: infer K extends keyof T } ? ReadonlyArray<ByIdItem<T, K>> : ReadonlyArray<T>;

type RuleAt<A, K> = A extends object ? (K extends keyof A ? A[K] : undefined) : undefined;

type OverrideValue<V, A> = V extends ReadonlyArray<infer T>
  ? ArrayOverride<T, A>
  : IsMergeable<V> extends true
    ? DeepOverride<V, A>
    : V;

/** 既定 D への深い上書き(A = 配列の規則)。省略できるキーだけ null(= 消す)を書ける */
export type DeepOverride<D, A = undefined> = {
  readonly [K in keyof D]?: OverrideValue<NonNullable<D[K]>, RuleAt<A, K>> | (K extends OptionalKeys<D> ? null : never);
};

/** 上書きの型。Extra = fork 独自のキー(型引数で足す) */
export type Override<D, A = undefined, Extra extends object = Record<never, never>> = DeepOverride<D, A> & Extra;

/** defineConfig の返す定義 */
export interface ConfigDefinition<D extends object, R extends ConfigRules<D>> {
  readonly defaults: D;
  readonly rules: R;
  /** 既定に上書きを合成し、検査して返す(既定は変えない) */
  compose<Extra extends object = Record<never, never>>(override: NoInfer<Override<D, R["arrays"], Extra>>): D & Extra;
}

/** 定義から上書きの型を引く(lib は `export type XxxOverride<E extends object = {}> = OverrideOf<typeof xxxConfigDef, E>` を出す) */
export type OverrideOf<Def, Extra extends object = Record<never, never>> =
  Def extends ConfigDefinition<infer D, infer R> ? Override<D, R["arrays"], Extra> : never;
