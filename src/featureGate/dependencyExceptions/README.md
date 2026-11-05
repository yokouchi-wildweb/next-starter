# dependencyExceptions

依存の検査(`checks/dependencies.test.mjs`)の例外の受け口(1 項目 1 ファイル `<名前>.ts` の `export const exception: DependencyException = { file, reason }`)。上流の項目は 0(上流の結線は確かめる側で通す)。

閉じられる機能のフォルダを、確かめずに外から読んでよいファイルを理由つきで書く。字面で判定できない物(動的 import・wiring の遅延 import など)が主な対象。先に `domainEntry.ts` の `requires`・`gate.enabled` / `gate.assert` / `useGate().enabled`・`required/` で通せないかを見る。当たらなくなった行は失敗する(縮む表)。詳細: `../README.md`「依存の検査」
