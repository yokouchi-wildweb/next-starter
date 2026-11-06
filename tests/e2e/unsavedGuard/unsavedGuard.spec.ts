// tests/e2e/unsavedGuard/unsavedGuard.spec.ts — pnpm e2e tests/e2e/unsavedGuard(chromium・firefox・webkit、設定 playwright.config.default.ts)
// 未保存の編集の守り(src/lib/unsavedGuard)の受入: 編集済みのフォームから 4 つの経路(棚の Link・router.push・戻る / 進む・
// 再読み込みと離脱)と素の <a> で離れようとすると確認が出て、留まるなら画面も住所も入力もそのまま、移るなら元の行き先へ進む。
// fork の自作 2 つが受けない経路(router.push・戻る / 進む)もこの lib は受ける(比べの表: src/lib/unsavedGuard/README.md)。
// ページは門番の規則 e2eFixtures(既定で閉じる)の /e2e/unsaved-guard。閉じている間は理由を出して skip する。開き方: ./README.md

import { createHash } from "node:crypto";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { type BrowserContext, chromium, expect, type Page, test as base } from "@playwright/test";
import { config as loadEnv } from "dotenv";

import { DEV_ADMIN_EMAIL, devAdminPassword } from "../../../scripts/tasks/dev-admin";
import { skipWhileClosed } from "../featureGate";

// パスワードは AUTH_JWT_SECRET から決まる(dev-admin と同じ式)。env ファイルの場所は ENV_FILE(既定 .env.development)
loadEnv({ path: process.env.ENV_FILE ?? ".env.development", quiet: true });

type StorageState = Awaited<ReturnType<BrowserContext["storageState"]>>;
type AdminState = { storageState: StorageState } | { skip: string };

/**
 * ログインした cookie の置き場(OS の一時フォルダ。test-results は実行ごとに消える)。
 * ログインには回数の上限(rate-limit.config.ts の login: 15 分に 5 回)があるので、実行・ブラウザ・ワーカーをまたいで 30 分使い回す
 */
const authFile = (baseURL: string) =>
  join(tmpdir(), `next-starter-e2e-dev-admin-${createHash("sha256").update(baseURL).digest("hex").slice(0, 12)}.json`);
const AUTH_MAX_AGE_MS = 30 * 60 * 1000;

function readCachedState(file: string): StorageState | null {
  try {
    if (Date.now() - statSync(file).mtimeMs > AUTH_MAX_AGE_MS) return null;
    return JSON.parse(readFileSync(file, "utf8")) as StorageState;
  } catch {
    return null;
  }
}

/** ワーカーごとに 1 回ログインし(置き場に新しい cookie があればそれを使う)、その cookie を各テストに渡す(届かなければ skip の理由) */
// フィクスチャの 2 番目の引数(Playwright の use)は provide と呼ぶ(react-hooks の lint が use を React の hook と取り違えるため)
const test = base.extend<{ admin: void }, { adminState: AdminState }>({
  adminState: [
    async ({}, provide, workerInfo) => {
      const baseURL = workerInfo.project.use.baseURL ?? "http://localhost:3000";
      const file = authFile(baseURL);
      const cached = readCachedState(file);
      if (cached) {
        await provide({ storageState: cached });
        return;
      }
      const secret = process.env.AUTH_JWT_SECRET;
      if (!secret) {
        await provide({ skip: "AUTH_JWT_SECRET が無い(pnpm env:init。dev-admin のパスワードが決まらない)" });
        return;
      }
      // ログインはどのブラウザの回でも chromium で行う(webkit は http の住所で Secure のセッションの cookie を保存しないため、
      // 自分ではログインできない)。cookie は下の storageState で各ブラウザへ写す
      const browser = await chromium.launch();
      const context = await browser.newContext({ baseURL });
      const page = await context.newPage();
      try {
        const response = await page.goto("/admin/login", { timeout: 120_000 }).catch(() => null);
        if (!response || !response.ok()) {
          await provide({ skip: `開発サーバーに届かない(${baseURL}/admin/login。E2E_BASE_URL で指す)` });
          return;
        }
        await page.locator("#admin-login-email").fill(DEV_ADMIN_EMAIL);
        await page.locator("#admin-login-password").fill(devAdminPassword(secret));
        const login = page.waitForResponse("**/api/auth/local/login", { timeout: 120_000 }).catch(() => null);
        await page.getByRole("button", { name: "ログイン", exact: true }).click();
        const status = (await login)?.status();
        if (status === 429) {
          await provide({ skip: "ログインの回数の上限に当たった(15 分に 5 回。少し待ってからもう一度)" });
          return;
        }
        const loggedIn = await page
          .waitForURL((url) => url.pathname === "/admin", { timeout: 120_000 })
          .then(() => true)
          .catch(() => false);
        if (!loggedIn) {
          await provide({ skip: `dev-admin の管理者でログインできない(応答 ${status ?? "なし"}。先に pnpm task dev-admin)` });
          return;
        }
        const state = await context.storageState();
        writeFileSync(file, JSON.stringify(state));
        await provide({ storageState: state });
      } finally {
        await browser.close();
      }
    },
    { scope: "worker", timeout: 300_000 },
  ],
  // セッションの cookie は常に Secure(auth/constants/session.ts)。webkit は http://localhost へ Secure の cookie を送らないので、
  // http の住所に向けるときだけ Secure を外して写す(テストの側の写し方だけ。本番の https では起きない)
  storageState: async ({ adminState, baseURL }, provide) => {
    if (!("storageState" in adminState)) return provide(undefined);
    const insecure = (baseURL ?? "").startsWith("http://");
    const state = adminState.storageState;
    await provide(insecure ? { ...state, cookies: state.cookies.map((c) => ({ ...c, secure: false })) } : state);
  },
  admin: [
    async ({ adminState }, provide) => {
      if ("skip" in adminState) console.log(`[e2e] skip: ${adminState.skip}`);
      test.skip("skip" in adminState, "skip" in adminState ? adminState.skip : "");
      await provide();
    },
    { auto: true },
  ],
});

skipWhileClosed("sampleDomain");

/** 番兵が積まれるのを待つ(守りが入った印) */
const waitForSentinel = (page: Page) =>
  page.waitForFunction(() => Boolean((history.state as Record<string, unknown> | null)?.__unsavedGuardSentinel));

/** アプリの確認(Overlays の Dialog) */
const leaveButton = (page: Page) => page.getByRole("button", { name: "離れる" });
const stayButton = (page: Page) => page.getByRole("button", { name: "留まる" });

/**
 * アプリの中の遷移のクリック(要素に click を送る)。一覧の表の行のセルが「編集」のリンクに重なり、座標のクリックが届かないため。
 * Link の onClick(Next のクライアントの遷移)はそのまま走る
 */
const clickInApp = (locator: ReturnType<Page["locator"]>) => locator.evaluate((el) => (el as HTMLElement).click());

/**
 * サイドバーの棚の Link「ダッシュボード」(/admin。SP と PC の 2 つのうち見えている方)。
 * ほかの行(サンプル・サンプルタグなど)はホバーで開く小さなメニューの中にあり、そのままでは押せないので最上段の行を使う
 */
const DASHBOARD = /\/admin$/;
const sidebarLink = (page: Page) => page.locator('aside a[href="/admin"]:visible', { hasText: "ダッシュボード" }).first();

// firefox は page.reload() で beforeunload を出さないので、ページの中から location.reload() を呼ぶ(全ブラウザで同じ手順)。
// firefox は 1 つのページで 2 回目の確認を出さないことがあるので、留まると移るを別のテストにする
const reloadFromPage = (page: Page) => page.evaluate(() => setTimeout(() => location.reload(), 0));

// ---- フォーム: 管理のサンプルタグ編集(AppForm) ----

const TAG_LIST = "/admin/sample-tags";
const EDITED = "edited by e2e";

type DirtyForm = { editUrl: string; field: ReturnType<Page["locator"]> };

/** 一覧 → 先頭の行の編集(戻るの行き先を作る)→ 先頭の入力を書き換えて編集済みにする */
async function openDirtyTagForm(page: Page): Promise<DirtyForm> {
  await page.goto(TAG_LIST);
  const edit = page.locator(`main a[href^="${TAG_LIST}/"][href*="/edit"]:visible`).first();
  test.skip((await edit.count()) === 0, "サンプルタグが 0 件(開発用 DB に 1 件以上要る)");
  await clickInApp(edit);
  await page.waitForURL(/\/admin\/sample-tags\/[^/]+\/edit/);
  const editUrl = page.url();
  const field = page.locator("main form").getByRole("textbox").first();
  await expect(field).toBeVisible();
  // 本当のクリックで入る(firefox はユーザーの操作の後でないと beforeunload の確認を出さない。clickInApp の click は操作に数えない)
  await field.click();
  await field.fill(EDITED);
  await waitForSentinel(page);
  return { editUrl, field };
}

async function expectFormStayed(page: Page, form: DirtyForm) {
  await expect(page).toHaveURL(form.editUrl);
  await expect(form.field).toHaveValue(EDITED);
}

/** 前後の項目へ移る(ItemNavigator の選択欄、中は守り付きの router.push)で、今と違う項目を選ぶ */
async function pickOtherItem(page: Page) {
  await page.locator("header").getByRole("combobox").first().click();
  const options = page.getByRole("option");
  await expect(options.first()).toBeVisible();
  const count = await options.count();
  test.skip(count < 2, "サンプルタグが 1 件だけ(前後の項目へ移るには 2 件以上要る)");
  for (let i = 0; i < count; i += 1) {
    const option = options.nth(i);
    if ((await option.getAttribute("aria-selected")) !== "true") {
      await option.click();
      return;
    }
  }
}

const FORM_PATHS: { name: string; trigger: (page: Page) => Promise<void>; leaveTo: (form: DirtyForm) => RegExp | string }[] = [
  { name: "棚の Link(サイドバー)", trigger: (page) => sidebarLink(page).click(), leaveTo: () => DASHBOARD },
  { name: "router.push(前後の項目へ移る)", trigger: pickOtherItem, leaveTo: (form) => new RegExp(`/admin/sample-tags/(?!${form.editUrl.split("/").at(-2)})[^/]+/edit`) },
  { name: "ブラウザの戻る", trigger: async (page) => void (await page.goBack({ waitUntil: "commit" }).catch(() => null)), leaveTo: () => new RegExp(`${TAG_LIST}$`) },
];

for (const path of FORM_PATHS) {
  test(`フォーム ${path.name}: 留まると住所も入力もそのまま`, async ({ page }) => {
    const form = await openDirtyTagForm(page);
    await path.trigger(page);
    await expect(page.getByText("編集中の内容があります")).toBeVisible();
    await stayButton(page).click();
    await expectFormStayed(page, form);
  });

  test(`フォーム ${path.name}: 移ると元の行き先へ進む`, async ({ page }) => {
    const form = await openDirtyTagForm(page);
    await path.trigger(page);
    await leaveButton(page).click();
    await expect(page).toHaveURL(path.leaveTo(form));
  });
}

test("フォーム ブラウザの進む: 編集済みの間は進む履歴が番兵で消え、フォームから離れない", async ({ page }) => {
  await page.goto(TAG_LIST);
  const edit = page.locator(`main a[href^="${TAG_LIST}/"][href*="/edit"]:visible`).first();
  test.skip((await edit.count()) === 0, "サンプルタグが 0 件");
  await clickInApp(edit);
  await page.waitForURL(/\/admin\/sample-tags\/[^/]+\/edit/);
  const editUrl = page.url();
  await sidebarLink(page).click();
  await expect(page).toHaveURL(DASHBOARD);
  await page.goBack();
  await expect(page).toHaveURL(editUrl);
  const field = page.locator("main form").getByRole("textbox").first();
  await field.click();
  await field.fill(EDITED);
  await waitForSentinel(page);
  await page.goForward().catch(() => null);
  await expectFormStayed(page, { editUrl, field });
});

test("フォーム 再読み込み: ブラウザの確認(beforeunload)で留まると入力がそのまま", async ({ page }) => {
  const form = await openDirtyTagForm(page);
  const dialog = page.waitForEvent("dialog");
  await reloadFromPage(page);
  const shown = await dialog;
  expect(shown.type()).toBe("beforeunload");
  await shown.dismiss();
  await expectFormStayed(page, form);
});

test("フォーム 再読み込み: ブラウザの確認(beforeunload)で移ると読み直す", async ({ page }) => {
  const form = await openDirtyTagForm(page);
  page.once("dialog", (dialog) => void dialog.accept());
  await Promise.all([page.waitForEvent("load"), reloadFromPage(page)]);
  await expect(form.field).not.toHaveValue(EDITED);
});

test("フォーム タブを閉じる: ブラウザの確認(beforeunload)で留まると閉じず、移ると閉じる", async ({ page }) => {
  const form = await openDirtyTagForm(page);
  page.once("dialog", (dialog) => {
    expect(dialog.type()).toBe("beforeunload");
    void dialog.dismiss();
  });
  await page.close({ runBeforeUnload: true });
  await page.waitForTimeout(500);
  expect(page.isClosed()).toBe(false);
  await expectFormStayed(page, form);

  page.once("dialog", (dialog) => void dialog.accept());
  await page.close({ runBeforeUnload: true });
  await page.waitForEvent("close");
  expect(page.isClosed()).toBe(true);
});

test("フォーム 送信: 保存は聞かずに一覧へ進み、編集していない画面も聞かない", async ({ page }) => {
  const form = await openDirtyTagForm(page);
  // 開発用 DB のサンプルのデータは変えてよい(ボスの決定 D14)。送信は守りを外して進む
  await form.field.fill(`e2e-saved-${Date.now()}`);
  await page.locator("main form").getByRole("button", { name: "更新" }).click();
  await expect(page).toHaveURL(new RegExp(`${TAG_LIST}$`), { timeout: 30_000 });
  await expect(stayButton(page)).toHaveCount(0);
  await sidebarLink(page).click();
  await expect(page).toHaveURL(DASHBOARD);
  await expect(stayButton(page)).toHaveCount(0);
});

// ---- 表の直接の編集: デモの表(/demo/tables の EditableGridTable) ----
// 書きかけのセル(入力して未確定)の間、表が守りの元を立てる(理由 = 未保存)

const DEMO_TABLES = "/demo/tables";
const DEMO_INDEX = "/demo";

/** EditableGridTable デモの表(見出しのすぐ外の Block の、隣の表) */
const demoGrid = (page: Page) =>
  page
    .getByRole("heading", { name: "EditableGridTable デモ", exact: true })
    .locator('xpath=ancestor::*[@data-component="Block"][1]/..')
    .locator("table")
    .first();
/** 書き込める文字の列(説明)の先頭の行のセル */
const textCell = (page: Page) => demoGrid(page).locator('tbody tr:first-child td[data-editor-type="text"]').first();
const cellEditor = (page: Page) => textCell(page).locator("input, textarea").first();

/**
 * 表 → 先頭の行の説明のセルを書きかけにする(番兵が積まれるのを待つ)。
 * 書く値は毎回変える(前の実行で確定して保存された値と同じだと変更にならず、書きかけにならない)
 */
async function openDraftCell(page: Page): Promise<string> {
  const value = `e2e-draft-${Date.now()}`;
  // デモの一覧から Link で入る(戻るがアプリの中の遷移になり、アプリの確認が出る)
  await page.goto(DEMO_INDEX);
  await page.locator(`a[href="${DEMO_TABLES}"]:visible`).first().click();
  await page.waitForURL(`**${DEMO_TABLES}`);
  const cell = textCell(page);
  await expect(cell).toBeVisible({ timeout: 30_000 });
  // 表の行は読み込みの後に描き直されることがあり、先に開いた書きかけは消える: 番兵が積まれるまで開いて書くを繰り返す
  await expect(async () => {
    if ((await cellEditor(page).count()) === 0) await cell.dblclick();
    await cellEditor(page).fill(value);
    await page.waitForFunction(
      () => Boolean((history.state as Record<string, unknown> | null)?.__unsavedGuardSentinel),
      null,
      { timeout: 3_000 },
    );
  }).toPass({ timeout: 40_000 });
  return value;
}

async function expectDraftKept(page: Page, value: string) {
  await expect(page).toHaveURL(DEMO_TABLES);
  await expect
    .poll(async () => {
      const editor = cellEditor(page);
      if ((await editor.count()) > 0) return editor.inputValue();
      return textCell(page).innerText();
    })
    .toContain(value);
}

test.describe("表", () => {
  skipWhileClosed("demoPages");

  test("表: 書きかけのセルでブラウザの戻る → 確認(未保存の文)、留まると値がそのまま", async ({ page }) => {
    const value = await openDraftCell(page);
    await page.goBack({ waitUntil: "commit" }).catch(() => null);
    await expect(page.getByText("編集中の内容があります")).toBeVisible();
    await stayButton(page).click();
    await expectDraftKept(page, value);
  });

  test("表: 書きかけのセルでブラウザの戻る → 移るとデモの一覧へ", async ({ page }) => {
    await openDraftCell(page);
    await page.goBack({ waitUntil: "commit" }).catch(() => null);
    await leaveButton(page).click();
    await expect(page).toHaveURL(/\/demo$/);
  });

  test("表: 書きかけのセルで再読み込み → ブラウザの確認(beforeunload)、留まると値がそのまま", async ({ page }) => {
    const value = await openDraftCell(page);
    const dialog = page.waitForEvent("dialog");
    await reloadFromPage(page);
    const shown = await dialog;
    expect(shown.type()).toBe("beforeunload");
    await shown.dismiss();
    await expectDraftKept(page, value);
  });
});

// ---- 処理の途中: 管理のサンプル一覧のデータの取り込み(DataMigrationModal) ----
// 取り込みの API(/api/data-migration/import-chunk)の要求を止めて「取り込み中」を作り、最後に中止する(サーバーには届かない = データは変わらない)。
// 取り込むのは同じ画面でエクスポートした ZIP。取り込みが終わった後(守りが外れる)は確かめない: 開発サーバーでは取り込みの要求が
// 長く返らないことがある(要求を止めずに 1 分半待っても終わらなかった)ため。終わった後の守りの外れ方は pnpm test:unsaved-guard の importGuard

test("取り込み: 取り込み中に棚の Link → 「処理の途中です」、留まると画面も取り込みの表示もそのまま", async ({ page }) => {
  await page.goto("/admin/samples");
  const openModal = () => page.getByRole("button", { name: "ファイル入出力" }).click();
  await openModal();
  const dialog = page.getByRole("dialog");
  const download = page.waitForEvent("download");
  // 「画像を含める」はオンのまま(取り込みは ZIP だけ受ける)。エクスポートが終わるとモーダルは閉じる
  await dialog.getByRole("button", { name: "エクスポート", exact: true }).click();
  // 取り込みはファイル名の .zip を見るので、名前を付けて保存する(download.path() は拡張子の無い一時の名前)
  const zipPath = join(tmpdir(), `next-starter-e2e-${test.info().project.name}-${Date.now()}.zip`);
  await (await download).saveAs(zipPath);

  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/data-migration/import-chunk", async (route) => {
    await held;
    await route.abort();
  });

  await expect(dialog).toBeHidden({ timeout: 30_000 });
  await openModal();
  await dialog.getByRole("tab", { name: "インポート" }).click();
  await dialog.locator('input[type="file"][accept=".zip"]').setInputFiles(zipPath);
  const importRequest = page.waitForRequest("**/api/data-migration/import-chunk");
  await dialog.getByRole("button", { name: "インポート", exact: true }).click();
  await importRequest;
  await waitForSentinel(page);

  // モーダルの覆いの下のリンク(座標のクリックは覆いに当たる): 要素に click を送る
  await clickInApp(sidebarLink(page));
  await expect(page.getByText("処理の途中です")).toBeVisible();
  await stayButton(page).click();
  await expect(page).toHaveURL(/\/admin\/samples$/);

  await expect(dialog.getByText("インポート中...")).toBeVisible();
  release();
});

// ---- 並べ替えの保存待ち: 管理のサンプルの並び替え(SortableList) ----
// 並べ替えの API(/api/sample/<id>/reorder)の応答を止めて「保存待ち」を作る。先頭のつかみ手をマウスで 2 つ目の下へ動かす

test("並び替え: 保存待ちの間は棚の Link に確認、保存が終われば聞かずに進む", async ({ page }) => {
  await page.goto("/admin/samples/sort");
  const handles = page.locator('[aria-roledescription="sortable"]');
  await handles.first().waitFor({ timeout: 30_000 }).catch(() => null);
  test.skip((await handles.count()) < 2, "サンプルが 2 件未満(並べ替えられない)");

  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/sample/*/reorder", async (route) => {
    await held;
    await route.continue();
  });

  const reorderRequest = page.waitForRequest("**/api/sample/*/reorder");
  const from = await handles.nth(0).boundingBox();
  const to = await handles.nth(1).boundingBox();
  test.skip(!from || !to, "つかみ手の位置が取れない");
  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
  await page.mouse.down();
  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2 + 12, { steps: 4 });
  await page.mouse.move(to!.x + to!.width / 2, to!.y + to!.height / 2 + to!.height, { steps: 12 });
  await page.mouse.up();
  await reorderRequest;
  await waitForSentinel(page);

  await sidebarLink(page).click();
  await expect(page.getByText("編集中の内容があります")).toBeVisible();
  await stayButton(page).click();
  await expect(page).toHaveURL(/\/admin\/samples\/sort$/);

  release();
  await page.waitForResponse("**/api/sample/*/reorder");
  await sidebarLink(page).click();
  await expect(page).toHaveURL(DASHBOARD);
  await expect(stayButton(page)).toHaveCount(0);
});
