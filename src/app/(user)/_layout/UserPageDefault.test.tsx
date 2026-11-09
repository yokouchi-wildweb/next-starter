// UserPage の幅の既定が枠の設定 layout.pageContainerType(上書き src/config/layout/user.config.ts で変えた値)に従うことの検査
// (上書きをモックするため UserParts.test.tsx と別ファイル。実行: pnpm test src/app/(user)/_layout/UserPageDefault.test.tsx)
import { before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { type ReactNode } from "react";

mock.module("@/config/layout/user.config", { defaultExport: { layout: { pageContainerType: "narrowStack" } } });

let render: (node: ReactNode) => string;
let UserPage: typeof import("./UserPage").UserPage;
let Main: typeof import("@/components/Layout/Main").Main;
before(async () => {
  ({ renderToStaticMarkup: render } = await import("react-dom/server"));
  ({ UserPage } = await import("./UserPage"));
  ({ Main } = await import("@/components/Layout/Main"));
});

test("containerType を渡さない UserPage は上書きした layout.pageContainerType の幅で描く", () => {
  assert.equal(render(<UserPage>CHILD</UserPage>), render(<Main containerType="narrowStack">CHILD</Main>));
});

test("containerType の明示は config の既定より勝つ", () => {
  assert.equal(render(<UserPage containerType="wideShowcase">CHILD</UserPage>), render(<Main containerType="wideShowcase">CHILD</Main>));
});
