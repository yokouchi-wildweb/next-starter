// .notices/20261126-014453-domain-decl.registry.mjs の検査(上書きの移し。ファイルの中身だけで確かめる)。
// 実行: pnpm test .notices/20261126-014453-domain-decl.registry.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";

import { convertOverride } from "./20261126-014453-domain-decl.registry.mjs";

test("domainEntryOverrides のキーごとに entity.override.ts を作り、値に使う名前の import だけを道を直して持っていく", () => {
  const text = [
    'import type { DomainEntryOverrides } from "@/lib/domain";',
    'import { ADMIN_ONLY, PUBLIC_READ } from "@/lib/domainAccess";',
    'import { OPEN } from "../../constants/access";',
    "",
    "export const domainEntryOverrides = {",
    "  user: { ...PUBLIC_READ, operations: { export: OPEN } },",
    "  userTag: ADMIN_ONLY,",
    "} satisfies DomainEntryOverrides;",
    "",
  ].join("\n");
  const { files, problems } = convertOverride(text);
  assert.deepEqual(problems, []);
  assert.deepEqual(Object.keys(files), ["user", "userTag"]);
  assert.match(files.user, /import type \{ EntityOverride \} from "@\/lib\/domain";/);
  assert.match(files.user, /import \{ PUBLIC_READ \} from "@\/lib\/domainAccess";/);
  assert.match(files.user, /import \{ OPEN \} from "\.\.\/\.\.\/constants\/access";/, "services/server/ と entities/<登録名>/ は同じ深さ");
  assert.match(files.user, /export const entityOverride = \{\n {2}apiAccess: \{ \.\.\.PUBLIC_READ, operations: \{ export: OPEN \} \},\n\} satisfies EntityOverride;/);
  assert.doesNotMatch(files.userTag, /PUBLIC_READ|OPEN|DomainEntryOverrides/);
  assert.match(files.userTag, /apiAccess: ADMIN_ONLY,/);
});

test("services/server/ の隣のファイルへの ./ は entities/<登録名>/ から辿り直す", () => {
  const text = 'import { RULE } from "./rule";\nexport const domainEntryOverrides = { foo: { read: RULE, write: RULE } };\n';
  assert.match(convertOverride(text).files.foo, /from "\.\.\/\.\.\/services\/server\/rule"/);
});

test("読めない上書きは問題を返す", () => {
  assert.equal(convertOverride("export const other = {};").problems.length, 1);
});
