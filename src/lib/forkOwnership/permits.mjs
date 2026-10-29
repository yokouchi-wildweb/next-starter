// 一時許可(fork が持つ .fork-ownership/<fork-id>.permits.txt)の読み取り・指紋・照合。
// git には触れない純粋関数(ファイルの取得と解決済みの依頼の集合は呼び出し側)。Node 組み込みだけで動く .mjs
// 仕様: ./README.md「一時許可」

import { createHash } from "node:crypto";

import { matchIntake } from "./intake.mjs";
import { stripOwnedRegions } from "./regions.mjs";

export const PERMITS_DIR = ".fork-ownership";
export const permitsPath = (forkId) => `${PERMITS_DIR}/${forkId}.permits.txt`;

const UPREQ_ID = /^\d{8}-\d{6}-[a-z0-9][a-z0-9-]*$/;
const FINGERPRINT = /^([0-9a-f]{40}|-)$/;

/**
 * 1 行 1 許可: `<path> upreq:<id>[,<id>…] base:<指紋|-> head:<指紋|->  # 理由`
 * @returns {{ permits: { path: string, upreqs: string[], base: string, head: string, note: string, line: number }[], errors: { line: number, message: string }[] }}
 */
export function parsePermits(text) {
  const permits = [];
  const errors = [];
  const seen = new Map();
  text.split("\n").forEach((raw, index) => {
    const line = index + 1;
    const body = raw.replace(/\s+#.*$/, "").trim();
    if (body === "" || body.startsWith("#")) return;
    const note = raw.includes(" #") ? raw.slice(raw.indexOf(" #") + 2).trim() : "";

    const [path, ...rest] = body.split(/\s+/);
    const fields = Object.fromEntries(
      rest.map((part) => {
        const colon = part.indexOf(":");
        return colon === -1 ? [part, ""] : [part.slice(0, colon), part.slice(colon + 1)];
      }),
    );
    const problems = [];
    if (rest.length !== 3 || !("upreq" in fields) || !("base" in fields) || !("head" in fields)) {
      problems.push("書式は `<path> upreq:<id>[,<id>…] base:<指紋|-> head:<指紋|->  # 理由`");
    } else {
      const upreqs = fields.upreq.split(",").filter(Boolean);
      if (upreqs.length === 0) problems.push("直接の親への依頼の番号が 1 つ以上要る");
      for (const id of upreqs) if (!UPREQ_ID.test(id)) problems.push(`依頼の番号の形が違う(${id})`);
      if (!FINGERPRINT.test(fields.base) || !FINGERPRINT.test(fields.head)) problems.push("指紋は 40 桁の git blob id か `-`");
      if (fields.base === "-" && fields.head === "-") problems.push("base と head の両方が `-`");
    }
    if (note === "") problems.push("理由(`# …`)が無い");
    if (seen.has(path)) problems.push(`同じパスの行が ${seen.get(path)} 行目にもある(1 ファイル 1 行)`);
    seen.set(path, line);

    if (problems.length > 0) {
      for (const message of problems) errors.push({ line, message });
      return;
    }
    permits.push({ path, upreqs: fields.upreq.split(",").filter(Boolean), base: fields.base, head: fields.head, note, line });
  });
  return { permits, errors };
}

/** テキストの git blob id(`git hash-object --stdin` と同じ値)。null = ファイルが無い → `-` */
export function blobId(text) {
  if (text === null) return "-";
  const body = Buffer.from(text, "utf8");
  return createHash("sha1").update(Buffer.concat([Buffer.from(`blob ${body.length}\0`), body])).digest("hex");
}

/**
 * 許可の指紋 = 区画の中身を除いたテキストの blob id(D22)。region の kind は fork の区画も除き、他は生成器の区画だけを除く。
 */
export function fingerprint(text, kind) {
  if (text === null) return "-";
  return blobId(stripOwnedRegions(text, { fork: kind === "region" }));
}

/**
 * judge の結果に一時許可を当てる。
 * - 違反ごとの permit: none | valid | expired-resolved(全番号が解決済み)| expired-base(基準側の指紋が違う = 親がそのファイルに触った)| refresh(fork 側の指紋が違う = 許可し直し)
 *   valid の違反だけ verdict が `permitted`(合格)になる
 * - 残骸(leftovers): same-as-base(基準と同じに戻った)| unused(違反の無いファイルの行)。どちらも失敗
 * R の許可は移動元のパスに書く。
 * @param {{
 *   entries: { status: string, path: string, from?: string, kind: string | null, reason: string, verdict: string }[],
 *   permits: { path: string, upreqs: string[], base: string, head: string, line: number }[],
 *   baseText: (path: string) => string | null,
 *   headText: (path: string) => string | null,
 *   intake: { kind: string | null, glob: string, exclude: boolean, line: number }[],
 *   resolvedUpreqs: Iterable<string>,
 * }} input
 */
export function checkPermits({ entries, permits, baseText, headText, intake, resolvedUpreqs }) {
  const resolved = new Set(resolvedUpreqs);
  const byPath = new Map(permits.map((permit) => [permit.path, permit]));
  const used = new Set();

  const checked = entries.map((entry) => {
    if (entry.verdict !== "violation") return entry;
    const target = entry.status === "R" ? entry.from : entry.path;
    const permit = byPath.get(target);
    if (!permit) return { ...entry, permit: "none" };
    used.add(target);

    const kind = matchIntake(intake, target)?.kind ?? null;
    const base = fingerprint(baseText(target), kind);
    const head = entry.status === "D" || entry.status === "R" ? "-" : fingerprint(headText(target), kind);
    let state;
    if (permit.upreqs.every((id) => resolved.has(id))) state = "expired-resolved";
    else if (permit.base !== base) state = "expired-base";
    else if (permit.head !== head) state = "refresh";
    else state = "valid";
    return { ...entry, permit: state, permitLine: permit.line, verdict: state === "valid" ? "permitted" : "violation", fingerprints: { base, head } };
  });

  const leftovers = permits
    .filter((permit) => !used.has(permit.path))
    .map((permit) => {
      const kind = matchIntake(intake, permit.path)?.kind ?? null;
      const same = fingerprint(baseText(permit.path), kind) === fingerprint(headText(permit.path), kind);
      return { path: permit.path, line: permit.line, reason: same ? "same-as-base" : "unused" };
    });

  return { entries: checked, leftovers };
}
