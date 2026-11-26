// src/lib/domain/declarations.mjs
// 入口 "./declarations": ドメインの宣言の形(definition/declaration.mjs)と読み込みの部品(definition/readDomain.mjs)。ファイルを開かない素の JS
// (source を渡して読む)ので、地区の地図(src/lib/districtMap)のような node 以外でも読まれる lib からも使える。"./node" はこれと同じ物 + nodeDomainSource

export * from "./definition/declaration.mjs";
export { findRegistration, isGeneratedRegistration, isRegisteredRegistration, listDomains, primaryRegistrationOf, readDomain, readDomains } from "./definition/readDomain.mjs";
