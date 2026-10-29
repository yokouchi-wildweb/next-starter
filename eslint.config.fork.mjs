// fork が足す ESLint の設定(flat config の配列)。eslint.config.mjs が最後に読み足す。
// upstream は空で出荷し、以後このファイルを編集しない(fork の物。受け口: src/lib/forkOwnership/intake.txt)。
// 業務の規則(no-restricted-syntax で特定の書き込み経路を強制する等)や追加の plugin はここに書き、
// eslint.config.mjs は編集しない。plugin の import もこのファイルに書く。
//
// 例:
//   export default [
//     {
//       files: ["src/**/*.{ts,tsx}"],
//       rules: { "no-restricted-syntax": ["error", { selector: "…", message: "…" }] },
//     },
//   ];

/** @type {import("eslint").Linter.Config[]} */
const forkConfig = [];

export default forkConfig;
