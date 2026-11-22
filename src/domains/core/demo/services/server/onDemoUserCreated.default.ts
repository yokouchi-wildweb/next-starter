// デモユーザー作成後に実行されるフックの既定: 何もしない。スイッチ: ./onDemoUserCreated.ts
// プロジェクト固有の関連レコード（サンプルデータ等）を挿入するなら onDemoUserCreated.replace.ts を作り、スイッチをそこへ向ける。
// @example
// export async function onDemoUserCreated(userId: string): Promise<void> {
//   await sampleService.create({ userId, name: "サンプル" });
// }

/** 差替点 onDemoUserCreated の約束の型(置き換え .replace も同じ形の onDemoUserCreated を export する) */
export type OnDemoUserCreated = (userId: string) => Promise<void>;

export const onDemoUserCreated: OnDemoUserCreated = async () => {};
