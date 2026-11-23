// next.config.ts — このリポの Next の設定(型 5 self、各リポが自分の版を持つ)。Tier1 の本体 next.config.core.ts を読み、足す・包む・外す。
// 中間の段は自分の lib の関数を呼ぶだけにする(段ごとのファイルは作らない)。Tier1 の版は本体をそのまま使う
export { default } from "./next.config.core";
