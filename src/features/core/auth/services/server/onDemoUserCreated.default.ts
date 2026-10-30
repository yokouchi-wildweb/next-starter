// デモユーザー作成後に実行されるフックの既定: 何もしない。スイッチ: ./onDemoUserCreated.ts
// プロジェクト固有の関連レコード（サンプルデータ等）を挿入するなら onDemoUserCreated.<fork の名前>.ts を作り、スイッチをそこへ向ける。
// @example
// export async function onDemoUserCreated(userId: string): Promise<void> {
//   await sampleService.create({ userId, name: "サンプル" });
// }

export async function onDemoUserCreated(_userId: string): Promise<void> {}
