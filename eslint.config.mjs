// eslint.config.mjs — このリポの ESLint の設定(型 5 self、各リポが自分の版を持つ)。Tier1 の本体 eslint.config.core.mjs を読み、後ろに自分の設定を足す。
// 中間の段は自分の lib の関数を呼ぶだけにする(段ごとのファイルは作らない)。Tier1 の版は本体をそのまま使う
export { default } from "./eslint.config.core.mjs";
