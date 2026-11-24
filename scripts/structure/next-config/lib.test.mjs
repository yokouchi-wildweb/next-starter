// scripts/structure/next-config/lib.test.mjs
// next の設定の検査の判定。実行: pnpm test scripts/structure/next-config/lib.test.mjs(段階の next-config の check も回す)

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { ROUTE_MAP_FILE, parseRouteMapJsonl } from "../../../src/lib/screens/node.mjs";

import { USER_FRAME_PART_SLOTS, checkBuild, checkConfig, checkShells, frameRootHidden, isHoleRange, isUserFrame, loaderShellMode, locateShells, readShellBody, resolveConfig, shellPath, stripHiddenSegments, stripSlots, unrevealedSegments } from "./lib.mjs";

const repoRoot = join(import.meta.dirname, "../../..");

const CORE_PATTERNS = [{ protocol: "https", hostname: "firebasestorage.googleapis.com", pathname: "/v0/b/bucket/o/**" }];
/** 本体のままの設定(解いた後)と、check.ts が呼んだ rewrites()・generateBuildId() の答え */
const okConfig = () => ({
  cacheComponents: true,
  partialPrefetching: true,
  generateBuildId: () => "b1",
  env: { NEXT_BUILD_ID: "b1", APP_ENV: "development", FEATURE_GATE_TIER1: "true" },
  images: { remotePatterns: [...CORE_PATTERNS] },
});
const expected = (/** @type {Record<string, unknown>} */ over = {}) => ({
  tier1: true,
  appEnv: "development",
  corePatterns: CORE_PATTERNS,
  rewrites: { fallback: [{ source: "/__/:path*", destination: "https://proj.web.app/__/:path*" }] },
  buildId: "b1",
  ...over,
});

test("checkConfig: 本体のままの設定は通る(rewrites は配列でも組でも)", () => {
  assert.deepEqual(checkConfig(okConfig(), expected()), []);
  assert.deepEqual(checkConfig(okConfig(), expected({ rewrites: [{ source: "/__/:path*", destination: "https://p.web.app/__/:path*" }] })), []);
});

test("checkConfig: 約束ごとに 1 行(Tier1・段階・build の番号・Firebase の転送・cacheComponents・partialPrefetching)", () => {
  const one = (/** @type {(c: any) => void} */ change, over = {}) => {
    const config = okConfig();
    change(config);
    return checkConfig(config, expected(over));
  };
  assert.match(one((c) => (c.env.FEATURE_GATE_TIER1 = "false")).join(), /FEATURE_GATE_TIER1/);
  assert.match(one((c) => delete c.env.APP_ENV).join(), /APP_ENV/);
  assert.match(one((c) => delete c.generateBuildId, { buildId: undefined }).join(), /generateBuildId が無い/);
  assert.match(one(() => {}, { buildId: "other" }).join(), /NEXT_BUILD_ID/);
  assert.match(one(() => {}, { rewrites: { fallback: [] } }).join(), /Firebase の認証の転送/);
  assert.match(one(() => {}, { rewrites: undefined }).join(), /Firebase の認証の転送/);
  assert.equal(one((c) => (c.cacheComponents = false)).length, 1);
  assert.equal(one((c) => delete c.partialPrefetching).length, 1);
  assert.match(one((c) => (c.partialPrefetching = false)).join(), /partialPrefetching が true でない\(false\)/);
  assert.equal(checkConfig({}, expected({ rewrites: undefined, buildId: undefined, corePatterns: [] })).length, 6);
});

test("checkConfig: remotePatterns = 上流の置き場が全部残り、どれもホスト全体を許さない(fork の CDN のパスは足してよい)", () => {
  const withPatterns = (/** @type {unknown[]} */ patterns) => {
    const config = okConfig();
    config.images.remotePatterns = /** @type {any} */ (patterns);
    return checkConfig(config, expected());
  };
  assert.deepEqual(withPatterns([...CORE_PATTERNS, { protocol: "https", hostname: "cdn.example.com", pathname: "/acme/**" }]), [], "fork の CDN のパス");
  assert.deepEqual(withPatterns([...CORE_PATTERNS, new URL("https://cdn.example.com/acme/**")]), [], "URL の形");
  assert.match(withPatterns([]).join(), /上流の置き場が無い/);
  assert.match(withPatterns([...CORE_PATTERNS, { hostname: "cdn.example.com" }]).join(), /ホスト全体/);
  assert.match(withPatterns([...CORE_PATTERNS, { hostname: "cdn.example.com", pathname: "/**" }]).join(), /ホスト全体/);
  assert.match(withPatterns([...CORE_PATTERNS, { hostname: "*.example.com", pathname: "/a/**" }]).join(), /ホスト全体/);
});

test("resolveConfig: 関数の設定は (phase, { defaultConfig }) で呼んで待つ(包む fork の設定も解ける)", async () => {
  const seen = [];
  const wrapped = async (/** @type {string} */ phase, /** @type {{ defaultConfig: object }} */ ctx) => {
    seen.push(phase, ctx.defaultConfig);
    return { ...okConfig(), extra: 1 };
  };
  const defaultConfig = { d: 1 };
  const config = await resolveConfig(wrapped, { phase: "phase-production-build", defaultConfig });
  assert.equal(config.extra, 1);
  assert.deepEqual(seen, ["phase-production-build", defaultConfig]);
  assert.equal((await resolveConfig(okConfig(), { phase: "x", defaultConfig })).cacheComponents, true);
});

test("checkBuild: 成果物が無ければ null、true で /api の静的な route が無ければ通る、あれば名指す", () => {
  const dist = mkdtempSync(join(tmpdir(), "next-config-build-"));
  try {
    assert.equal(checkBuild(dist), null);
    const put = (cacheComponents, routes) => {
      writeFileSync(join(dist, "required-server-files.json"), JSON.stringify({ config: { cacheComponents } }));
      writeFileSync(join(dist, "prerender-manifest.json"), JSON.stringify({ version: 4, routes, dynamicRoutes: {} }));
    };
    put(true, { "/_not-found": {}, "/": {} });
    assert.deepEqual(checkBuild(dist), { problems: [], staticRoutes: 2 });

    put(false, {});
    assert.equal(checkBuild(dist).problems.length, 1);
    assert.match(checkBuild(dist).problems[0], /cacheComponents=false/);

    put(true, { "/api/health": {}, "/api/x/y": {}, "/apiary": {}, "/": {} });
    const r = checkBuild(dist);
    assert.equal(r.problems.length, 2);
    assert.ok(r.problems[0].startsWith("/api/health:"));
    assert.ok(r.problems[1].startsWith("/api/x/y:"));
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
});

/** route-map の行の形(page と guard だけ) */
const row = (path, pageFile, guards, extra = {}) => ({
  path,
  chain: [{ kind: "page", file: pageFile }, ...guards.map((access) => ({ kind: "guard", file: "x/guard.ts", policy: { access } }))],
  ...extra,
});

/** 空の殻(今の上流の形: 見える文字なし、穴の template と script だけ) */
const EMPTY_SHELL = '<html><head><script>theme()</script></head><body><div hidden><template id="B:0"></template></div><script>self.__next_f.push([1,"x"])</script>';

test("isHoleRange: public でない guard の鎖と、管理の枠(src/app/admin/ の下)のページが殻に入れない範囲", () => {
  assert.equal(isHoleRange(row("/", "src/app/(user)/page.tsx", ["public"])), false);
  assert.equal(isHoleRange(row("/mypage", "src/app/(user)/(protected)/mypage/page.tsx", [{ roleCategories: ["admin", "user"] }, "public"])), true);
  assert.equal(isHoleRange(row("/admin", "src/app/admin/(protected)/page.tsx", [{ roleCategories: ["admin"] }, "public"])), true);
  assert.equal(isHoleRange(row("/admin/login", "src/app/admin/login/page.tsx", ["public"])), true);
  assert.equal(isHoleRange(row("/debug", "src/app/debug/page.tsx", [{ roles: ["debugger"] }, "public"])), true);
});

test("isHoleRange: 今の route-map の範囲の数(保護の鎖 + 管理の枠の公開のページ)", () => {
  const rows = parseRouteMapJsonl(readFileSync(join(repoRoot, ROUTE_MAP_FILE), "utf8"));
  const hole = rows.filter(isHoleRange);
  const guarded = rows.filter((r) => r.chain.some((l) => l.kind === "guard" && l.policy?.access !== "public"));
  const adminPublic = hole.filter((r) => !guarded.includes(r)).map((r) => r.path).sort();
  assert.ok(guarded.length > 0);
  assert.equal(hole.length, guarded.length + adminPublic.length);
  for (const path of adminPublic) assert.ok(path.startsWith("/admin/"), path);
});

test("readShellBody: script・style・template・noscript の外の文字・メニューとリンク・data-frame-root を読む", () => {
  assert.deepEqual(readShellBody(EMPTY_SHELL), { frameRoot: false, text: "", navs: [] });
  const framed = readShellBody('<body><div data-frame-root="" data-x><nav>メニュー</nav></div><noscript>JS</noscript></body>');
  assert.equal(framed.frameRoot, true);
  assert.equal(framed.text, "メニュー");
  assert.deepEqual(framed.navs, ["<nav>"]);
  // 文字の無いリンク(アイコンだけ)・role の付いたメニューも拾う。abbr・aside・template の中は拾わない
  assert.deepEqual(readShellBody('<body><a href="/admin/users"><svg></svg></a><div role="navigation"></div><aside></aside><abbr></abbr><template><a href="/x"></a></template>').navs, ['<a href="/admin/users">', '<div role="navigation">']);
  assert.equal(readShellBody("<body><p>a&nbsp;b</p></body>").text, "a b");
  assert.equal(readShellBody('<body><div data-frame-rooted=""></div></body>').frameRoot, false);
  // 穴の残る殻は </body> で閉じない
  assert.deepEqual(readShellBody('<html><body class="x"><div hidden><template id="B:1"></template></div><div data-frame-root="">漏れ</div><script>x()</script>'), { frameRoot: true, text: "漏れ", navs: [] });
});

test("shellPath: / は index.html、[param] は名前のまま", () => {
  assert.equal(shellPath(".next", "/"), join(".next", "server", "app", "index.html"));
  assert.equal(shellPath(".next", "/admin/users/[id]"), join(".next", "server", "app", "admin", "users", "[id].html"));
});

test("locateShells: 素の build(server/app)と adapter の build(server/route-cache/APP_PAGE/<鍵>/$/)の両方から path ごとに引く", () => {
  const dist = mkdtempSync(join(tmpdir(), "cc-shell-loc-"));
  try {
    assert.equal(locateShells(dist).size, 0);
    const put = (rel, text) => {
      mkdirSync(dirname(join(dist, rel)), { recursive: true });
      writeFileSync(join(dist, rel), text);
    };
    put("server/route-cache/APP_PAGE/aa11/$/index.html", "root");
    put("server/route-cache/APP_PAGE/bb22/$/admin.html", "admin");
    put("server/route-cache/APP_PAGE/cc33/$/wallet/[slug].html", "wallet");
    put("server/route-cache/APP_PAGE/dd44/$/admin.meta", "{}");
    const adapter = locateShells(dist);
    assert.deepEqual([...adapter.keys()].sort(), ["/", "/admin", "/wallet/[slug]"]);
    assert.equal(adapter.get("/admin"), join(dist, "server/route-cache/APP_PAGE/bb22/$/admin.html"));
    put("server/app/admin.html", "plain");
    assert.equal(locateShells(dist).get("/admin"), join(dist, "server/app/admin.html"), "両方にあれば素の build の物");
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
});

test("checkShells: 殻が無ければ null、殻に入れない範囲の文字・メニューとリンク・殻の無いページを名指し、空の外枠・公開の範囲・閉じた機能は見ない", () => {
  const dist = mkdtempSync(join(tmpdir(), "cc-shell-"));
  try {
    const rows = [
      row("/", "src/app/(user)/page.tsx", ["public"]),
      row("/admin", "src/app/admin/(protected)/page.tsx", [{ roleCategories: ["admin"] }, "public"]),
      row("/admin/login", "src/app/admin/login/page.tsx", ["public"]),
      row("/mypage", "src/app/(user)/(protected)/mypage/page.tsx", [{ roleCategories: ["user"] }, "public"]),
      row("/mypage/wallet", "src/app/(user)/(protected)/mypage/wallet/page.tsx", [{ roleCategories: ["user"] }, "public"], { gatedOff: "wallet" }),
    ];
    assert.equal(checkShells(dist, rows), null);
    const put = (path, html) => {
      const file = shellPath(dist, path);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, html);
    };
    put("/", '<body><div data-frame-root=""><div data-frame-part="">公開の枠</div></div></body>');
    put("/admin", EMPTY_SHELL);
    // 空の外枠の入れ物は殻に入ってよい(D55)
    put("/admin/login", '<body><div data-slot="admin-app-container" data-frame-root=""><div><template id="P:4"></template></div></div><script>x()</script>');
    put("/mypage", EMPTY_SHELL);
    assert.deepEqual(checkShells(dist, rows), { problems: [], holePages: 4, publicPages: 1, framedPages: 1 });

    put("/admin", '<body><div data-frame-root=""><nav>利用者</nav></div></body>');
    put("/admin/login", '<body><div data-frame-root=""><a href="/admin/users"><svg></svg></a></div></body>');
    rmSync(shellPath(dist, "/mypage"));
    const r = checkShells(dist, rows);
    assert.equal(r.problems.length, 4);
    assert.ok(r.problems[0].startsWith("/admin: ") && r.problems[0].includes("利用者"));
    assert.ok(r.problems[1].startsWith("/admin: ") && r.problems[1].includes("<nav>"));
    assert.ok(r.problems[2].startsWith("/admin/login: ") && r.problems[2].includes("/admin/users"));
    assert.ok(r.problems[3].startsWith("/mypage: ") && r.problems[3].includes("殻の HTML が無い"));
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
});

test("isUserFrame: page のファイルが src/app/(user)/ の下", () => {
  assert.equal(isUserFrame(row("/", "src/app/(user)/page.tsx", ["public"])), true);
  assert.equal(isUserFrame(row("/entry", "src/app/(marketing)/entry/page.tsx", ["public"])), false);
  assert.equal(isUserFrame(row("/admin", "src/app/admin/(protected)/page.tsx", ["public"])), false);
});

test("stripSlots: data-slot の要素を中身ごと除く(入れ子・void・/> を数える)、ほかは残す", () => {
  const html =
    '<body><header data-slot="header"><div><a href="/">ロゴ</a><img src="x"><svg><path d="M0"/></svg></div></header>' +
    '<div data-frame-part=""><main>本文</main></div><footer data-slot="footer"><p>規約</p></footer>' +
    '<div data-slot="bottom-nav" class="s"></div><nav data-slot="bottom-nav"><a href="/a">A</a></nav><i>後</i>';
  assert.equal(stripSlots(html, USER_FRAME_PART_SLOTS), '<body><div data-frame-part=""><main>本文</main></div><i>後</i>');
  assert.equal(stripSlots(html, []), html);
});

test("checkShells: 公開の会員の枠のページの殻に枠が無ければ名指し、ログイン必須の範囲は会員の枠の部位を除いた本文で見る(D57)", () => {
  const dist = mkdtempSync(join(tmpdir(), "cc-shell-frame-"));
  try {
    const rows = [
      row("/", "src/app/(user)/page.tsx", ["public"]),
      row("/items/[id]", "src/app/(user)/items/[id]/page.tsx", ["public"]),
      row("/entry", "src/app/(marketing)/entry/page.tsx", ["public"]),
      row("/mypage", "src/app/(user)/(protected)/mypage/page.tsx", [{ roleCategories: ["user"] }, "public"]),
    ];
    const put = (path, html) => {
      const file = shellPath(dist, path);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, html);
    };
    const FRAMED = (body) =>
      `<body><div data-slot="app-container" data-frame-root=""><div data-frame-part="" class="contents"><header data-slot="header"><a href="/">ロゴ</a></header></div>` +
      `<div data-frame-part="" class="contents">${body}</div><div data-frame-part="" class="contents"><footer data-slot="footer"><a href="/terms">規約</a> © 2025</footer></div></div>`;
    put("/", FRAMED("<main>トップ</main>"));
    put("/items/[id]", EMPTY_SHELL);
    put("/entry", EMPTY_SHELL);
    put("/mypage", FRAMED('<div><template id="B:0"></template></div>'));
    assert.deepEqual(checkShells(dist, rows), { problems: [], holePages: 1, publicPages: 3, framedPages: 1 });

    // 枠が root の穴に落ちた公開のページ・保護された本文が殻に出たログイン必須のページ
    put("/", EMPTY_SHELL);
    put("/mypage", FRAMED('<main>残高 1,000 円<a href="/mypage/wallet">履歴</a></main>'));
    const r = checkShells(dist, rows);
    assert.equal(r.problems.length, 3);
    assert.ok(r.problems[0].startsWith("/: ") && r.problems[0].includes("枠"));
    assert.ok(r.problems[1].startsWith("/mypage: ") && r.problems[1].includes("残高"));
    assert.ok(r.problems[2].startsWith("/mypage: ") && r.problems[2].includes("/mypage/wallet"));
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
});

test("frameRootHidden: 外枠が未公開の区画(hidden の S:n)の中なら true、外か区画が先に閉じていれば false", () => {
  const frame = '<div data-slot="app-container" data-frame-root=""><div data-frame-part=""><header>ロゴ</header></div></div>';
  assert.equal(frameRootHidden(`<body>${frame}<template id="B:0"></template></body>`), false);
  assert.equal(frameRootHidden(`<body><template id="B:3"></template><div hidden id="S:3"><div class="x">${frame}</div></div></body>`), true);
  // 区画が外枠より前に閉じている(別の区画)・区画の入れ子の中の div を数える
  assert.equal(frameRootHidden(`<body><div hidden id="S:1"><div><div></div></div></div>${frame}</body>`), false);
  assert.equal(frameRootHidden(`<body><div hidden id="S:2"><div></div><div>${frame}</div></div></body>`), true);
  // 外枠が無ければ false(枠の有無は別の判定)
  assert.equal(frameRootHidden("<body><main>x</main></body>"), false);
});

test("checkShells: 公開の会員の枠が未公開の区画の中なら名指す", () => {
  const dist = mkdtempSync(join(tmpdir(), "cc-shell-hidden-"));
  try {
    const rows = [row("/", "src/app/(user)/page.tsx", ["public"])];
    const file = shellPath(dist, "/");
    mkdirSync(dirname(file), { recursive: true });
    const frame = '<div data-slot="app-container" data-frame-root=""><div data-frame-part="" class="contents"><header>ロゴ</header></div></div>';
    writeFileSync(file, `<body><template id="B:3"></template><div hidden id="S:3">${frame}</div>`);
    const r = checkShells(dist, rows);
    assert.equal(r.problems.length, 1);
    assert.ok(r.problems[0].startsWith("/: ") && r.problems[0].includes("未公開の区画"));
    writeFileSync(file, `<body>${frame}<template id="B:3"></template>`);
    assert.deepEqual(checkShells(dist, rows).problems, []);
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
});

test("loaderShellMode: load を省いた = no-load、shell: true = shell、それ以外(load あり・createLoader に組を渡す)= null", () => {
  assert.equal(loaderShellMode('export const loadX = createLoader({ access: "public" });'), "no-load");
  assert.equal(loaderShellMode('export const loadX = createLoader({\n  access: "public",\n  shell: true,\n  load: async () => 1,\n});'), "shell");
  assert.equal(loaderShellMode('export const loadX = createLoader({ access: "public", load: async () => db() });'), null);
  assert.equal(loaderShellMode('export const loadX = createLoader(adminListParts("sample"));'), null);
  // コメントの中の load: は数えない
  assert.equal(loaderShellMode('// load: は省く\nexport const loadX = createLoader({ access: "public" });'), "no-load");
});

test("stripHiddenSegments: 未公開の区画を中身ごと除く(入れ子の div を数える)", () => {
  assert.equal(stripHiddenSegments('<p>a</p><div hidden id="S:1"><div><b>x</b></div></div><p>b</p>'), "<p>a</p><p>b</p>");
  assert.equal(stripHiddenSegments("<p>a</p>"), "<p>a</p>");
});

test("checkShells: shell: true の公開のページは殻の本文に中身があること(load を省いただけのページは見ない)、守りの鎖の shell: true は問題", () => {
  const dist = mkdtempSync(join(tmpdir(), "cc-shell-decl-"));
  const repo = mkdtempSync(join(tmpdir(), "cc-shell-decl-src-"));
  try {
    const withLoader = (r, file) => ({ ...r, chain: [...r.chain, { kind: "loader", file }] });
    const putLoader = (file, text) => {
      mkdirSync(dirname(join(repo, file)), { recursive: true });
      writeFileSync(join(repo, file), text);
    };
    putLoader("src/app/(user)/terms/_screen/loader.ts", 'export const loadTerms = createLoader({ access: "public", shell: true, load: async () => 1 });');
    putLoader("src/app/(user)/verify/_screen/loader.ts", 'export const loadVerify = createLoader({ access: "public" });');
    putLoader("src/app/(user)/(protected)/mypage/_screen/loader.ts", 'export const loadMy = createLoader({ access: "public", shell: true, load: async () => 1 });');
    const rows = [
      withLoader(row("/terms", "src/app/(user)/terms/page.tsx", ["public"]), "src/app/(user)/terms/_screen/loader.ts"),
      withLoader(row("/verify", "src/app/(user)/verify/page.tsx", ["public"]), "src/app/(user)/verify/_screen/loader.ts"),
      withLoader(row("/mypage", "src/app/(user)/(protected)/mypage/page.tsx", [{ roleCategories: ["user"] }, "public"]), "src/app/(user)/(protected)/mypage/_screen/loader.ts"),
    ];
    const put = (path, html) => {
      const file = shellPath(dist, path);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, html);
    };
    const framed = (body) =>
      `<body><div data-slot="app-container" data-frame-root=""><div data-frame-part="" class="contents"><header data-slot="header">ロゴ</header></div><div data-frame-part="" class="contents">${body}</div></div>`;
    put("/mypage", framed('<template id="B:0"></template>'));
    // load を省いただけのページは本文が穴でも見ない(宣言ではない)
    put("/verify", framed('<template id="B:2"></template>'));
    // 本文が穴のまま(区画の中)
    put("/terms", `${framed('<template id="B:1"></template>')}<div hidden id="S:1"><main>規約</main></div>`);
    let r = checkShells(dist, rows, { repoRoot: repo });
    assert.ok(r.problems.some((p) => p.startsWith("/terms: ") && p.includes("shell: true")));
    assert.ok(!r.problems.some((p) => p.startsWith("/verify: ")));
    assert.ok(r.problems.some((p) => p.startsWith("/mypage: ") && p.includes("shell: true")));
    // 本文が殻に入れば通る(守りの鎖の shell: true は残る)
    put("/terms", framed("<main>規約</main>"));
    r = checkShells(dist, rows, { repoRoot: repo });
    assert.deepEqual(r.problems.map((p) => p.split(":")[0]), ["/mypage"]);
  } finally {
    rmSync(dist, { recursive: true, force: true });
    rmSync(repo, { recursive: true, force: true });
  }
});

test("unrevealedSegments: 殻の中の $RC が開く区画は除く(外枠・本文はその場で見える)", () => {
  const frame = '<div data-slot="app-container" data-frame-root=""><main>規約</main></div>';
  const revealedInShell = `<body><template id="B:9"></template><div hidden id="S:9">${frame}</div><script>$RC("B:9","S:9")</script>`;
  assert.deepEqual(unrevealedSegments(revealedInShell), []);
  assert.equal(frameRootHidden(revealedInShell), false);
  assert.match(stripHiddenSegments(revealedInShell), /規約/);
  const waiting = `<body><template id="B:3"></template><div hidden id="S:3">${frame}<template id="P:4"></template></div>`;
  assert.equal(unrevealedSegments(waiting).length, 1);
  assert.equal(frameRootHidden(waiting), true);
  assert.doesNotMatch(stripHiddenSegments(waiting), /規約/);
});
