// scripts/runner/gates/netGuard.mjs — build の門の検査に付ける preload(node --import)。外への接続を拒む
// fetch・http(s).request/get・net/tls の接続・dns の引きを、呼んだ時点で印 MARK を標準エラーに書いて throw する。
// 門のランナーは印を見て「build に宣言した検査が外に届いた」で落とす(検査が例外を握りつぶしても印で分かる)。
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";

export const MARK = "__GATE_NET_BLOCKED__";

function block(what) {
  return () => {
    process.stderr.write(`${MARK} ${what}\n`);
    throw new Error(`門の守り: build の検査は外に届いてはいけない(${what})`);
  };
}

globalThis.fetch = block("fetch");
for (const [mod, name, fns] of [
  [http, "http", ["request", "get"]],
  [https, "https", ["request", "get"]],
  [net, "net", ["connect", "createConnection"]],
  [tls, "tls", ["connect"]],
  [dns, "dns", ["lookup", "resolve", "resolve4", "resolve6"]],
  [dns.promises, "dns.promises", ["lookup", "resolve", "resolve4", "resolve6"]],
]) {
  for (const f of fns) mod[f] = block(`${name}.${f}`);
}
