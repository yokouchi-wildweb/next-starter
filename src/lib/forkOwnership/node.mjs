// src/lib/forkOwnership/node.mjs
// 入口 "./node": fork の所有の検査(Next の外のプログラム = scripts・lint・テスト・next.config が読む。React と Next を読まない)。
// 画面から読む物は無いので入口 "." は置かない。中身: ./README.md
// - forkIds: リポの名前と Tier(repo.json)の唯一の読み手 | check / cli: pnpm workflow ownership check | who / whoCli / explain: pnpm workflow ownership who
// - selfKeep: pnpm workflow ownership selfKeep(/flux が区間の merge の後に型 5 self を自分の版に戻す)
// - baseFiles・intake・regions・permits・lineage・self・judge・unitNames: 検査の部品 | testRepos: テストの部品(一時の git リポジトリ) | upstreamItems: 実際のリポを読むテストの上流の値の比べ方(Tier1 は完全一致、fork は上流 ⊆ 実際)

export * from "./baseFiles.mjs";
export * from "./check.mjs";
export * from "./cli.mjs";
export * from "./explain.mjs";
export * from "./forkIds.mjs";
export * from "./intake.mjs";
export * from "./judge.mjs";
export * from "./lineage.mjs";
export * from "./permits.mjs";
export * from "./regions.mjs";
export * from "./self.mjs";
export * from "./selfKeep.mjs";
export * from "./testRepos.mjs";
export * from "./unitNames.mjs";
export * from "./upstreamItems.mjs";
export * from "./who.mjs";
export * from "./whoCli.mjs";
