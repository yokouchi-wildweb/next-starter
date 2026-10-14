// src/app/(user)/page.tsx — トップページの差し替えスイッチ
//
// 上流(next-starter)はこのファイルを今後編集しない。トップページの中身は
// _components/StarterHome/ 側で変更する。下流プロジェクトは自前のトップページを
// _components/<Name>/ に作り、下の 1 行の import 先だけを差し替える。
// 手順と注意点: src/app/(user)/_components/StarterHome/README.md

export { StarterHome as default } from "./_components/StarterHome";
