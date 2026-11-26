// src/lib/domain/node.mjs
// 入口 "./node": Next の外のプログラム(scripts の生成器・検査、eslint-rules、servers)が読む物。素の node で読めるよう JS だけで、
// React・Next を引かない。中身は項目の型の表・入力種別の表・表示の答え・関連の選択肢の決まり(どれも "." からも出る)と、
// ドメインの宣言の形と読み込みの部品(入口 "./declarations" と同じ物)と、今の木を node:fs で読む source(nodeDomainSource は "./node" だけ)。
// scripts・eslint-rules からは相対(../src/lib/domain/node.mjs)、Next の外の .ts からは @/lib/domain/node.mjs

export * from "./fields/fieldTypes.mjs";
export * from "./fields/fieldFormInputs.mjs";
export * from "./fields/formInputs.mjs";
export * from "./fields/presenterFor.mjs";
export * from "./relations/relationOptions.mjs";
export * from "./declarations.mjs";
export { nodeDomainSource } from "./definition/nodeDomainSource.mjs";
