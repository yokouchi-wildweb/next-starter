// e2e/unsavedGuard.spec.ts — pnpm test:e2e:unsaved-guard(chromium・firefox・webkit)
// 未保存の編集の守り(src/lib/unsavedGuard)の受入: 編集済みのフォームから 4 つの経路(棚の Link・router.push・戻る / 進む・
// 再読み込みと離脱)と素の <a> で離れようとすると確認が出て、留まるなら画面も住所も入力もそのまま、移るなら元の行き先へ進む。
// fork の自作 2 つが受けない経路(router.push・戻る / 進む)もこの lib は受ける(比べの表: src/lib/unsavedGuard/README.md)。
// ページは門番の規則 e2eFixtures(既定で閉じる)の /e2e/unsaved-guard。開き方: e2e/README.md

import { expect, type Page, test } from "@playwright/test";

const START = "/e2e/unsaved-guard";
const FORM = "/e2e/unsaved-guard/form";
const TARGET = "/e2e/unsaved-guard/target";

/** 出発のページ → フォーム(戻るの行き先を作る)→ 入力して編集済みにする(番兵が積まれるのを待つ = 守りが入った印) */
async function openDirtyForm(page: Page) {
  await page.goto(START);
  await page.locator("#to-form").click();
  await expect(page).toHaveURL(FORM);
  await expect(page.locator("#page")).toHaveText("form");
  await page.locator("#note").fill("edited");
  await page.waitForFunction(() => Boolean((history.state as Record<string, unknown> | null)?.__unsavedGuardSentinel));
}

/** アプリの確認(Overlays の Dialog) */
const leaveButton = (page: Page) => page.getByRole("button", { name: "離れる" });
const stayButton = (page: Page) => page.getByRole("button", { name: "留まる" });

async function expectStayed(page: Page) {
  await expect(page).toHaveURL(FORM);
  await expect(page.locator("#page")).toHaveText("form");
  await expect(page.locator("#note")).toHaveValue("edited");
}

const IN_APP_PATHS: { name: string; trigger: (page: Page) => Promise<void>; leaveTo: string }[] = [
  { name: "棚の Link", trigger: (page) => page.locator("#shelf-link").click(), leaveTo: TARGET },
  { name: "素の <a>", trigger: (page) => page.locator("#raw-a").click(), leaveTo: TARGET },
  { name: "router.push", trigger: (page) => page.locator("#push").click(), leaveTo: TARGET },
  { name: "router.back", trigger: (page) => page.locator("#back").click(), leaveTo: START },
  { name: "ブラウザの戻る", trigger: async (page) => void (await page.goBack({ waitUntil: "commit" }).catch(() => null)), leaveTo: START },
];

for (const path of IN_APP_PATHS) {
  test(`${path.name}: 留まると画面・住所・入力がそのまま`, async ({ page }) => {
    await openDirtyForm(page);
    await path.trigger(page);
    await stayButton(page).click();
    await expectStayed(page);
  });

  test(`${path.name}: 移ると元の行き先へ進む`, async ({ page }) => {
    await openDirtyForm(page);
    await path.trigger(page);
    await leaveButton(page).click();
    await expect(page).toHaveURL(path.leaveTo);
  });
}

test("ブラウザの進む: 編集済みの間は進む履歴が番兵で消え、フォームから離れない(入力は失われない)", async ({ page }) => {
  await page.goto(START);
  await page.locator("#to-form").click();
  await page.locator("#shelf-link").click();
  await expect(page).toHaveURL(TARGET);
  await page.goBack();
  await expect(page).toHaveURL(FORM);
  await page.locator("#note").fill("edited");
  await page.waitForFunction(() => Boolean((history.state as Record<string, unknown> | null)?.__unsavedGuardSentinel));
  await page.goForward().catch(() => null);
  await expectStayed(page);
});

test("再読み込み: ブラウザの確認(beforeunload)で留まると入力がそのまま、移ると読み直す", async ({ page }) => {
  await openDirtyForm(page);
  page.once("dialog", (dialog) => {
    expect(dialog.type()).toBe("beforeunload");
    void dialog.dismiss();
  });
  // firefox は page.reload() で beforeunload を出さないので、ページの中から location.reload() を呼ぶ(全ブラウザで同じ手順)
  await page.evaluate(() => setTimeout(() => location.reload(), 0));
  await page.waitForTimeout(500);
  await expectStayed(page);

  page.once("dialog", (dialog) => void dialog.accept());
  await Promise.all([page.waitForEvent("load"), page.evaluate(() => setTimeout(() => location.reload(), 0))]);
  await expect(page.locator("#note")).toHaveValue("");
});

test("タブを閉じる: ブラウザの確認(beforeunload)で留まると閉じず、移ると閉じる", async ({ page }) => {
  await openDirtyForm(page);
  page.once("dialog", (dialog) => {
    expect(dialog.type()).toBe("beforeunload");
    void dialog.dismiss();
  });
  await page.close({ runBeforeUnload: true });
  await page.waitForTimeout(500);
  expect(page.isClosed()).toBe(false);
  await expectStayed(page);

  page.once("dialog", (dialog) => void dialog.accept());
  await page.close({ runBeforeUnload: true });
  await page.waitForEvent("close");
  expect(page.isClosed()).toBe(true);
});

test("送信: 保存は聞かずに進み(onSubmit の中の router.push)、編集していないページも聞かない", async ({ page }) => {
  await openDirtyForm(page);
  await page.locator("#save").click();
  await expect(page).toHaveURL(TARGET);
  await page.locator("#to-form").click();
  await expect(page).toHaveURL(FORM);
  await page.locator("#shelf-link").click();
  await expect(page).toHaveURL(TARGET);
});
