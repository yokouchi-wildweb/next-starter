// src/lib/domain/declarations.mjs
// lib/domain の中の部品(入口でない、入口 "./node" が再 export する): ドメインの宣言の形(definition/declaration.mjs)と読み込みの部品(definition/readDomain.mjs)。ファイルを開かない素の JS
// (source を渡して読む)。node の API を引けない lib(地区の地図 src/lib/districtMap の ".")は、自分の "./node" から渡されて使う。"./node" はこれ + nodeDomainSource

export * from "./definition/declaration.mjs";
export { findRegistration, isGeneratedRegistration, isRegisteredRegistration, listDomains, primaryRegistrationOf, readDomain, readDomains } from "./definition/readDomain.mjs";
