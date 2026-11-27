// src/domains/core/auth/constants/loginAnnouncement.ts の試し: 名前の知らせだけを文に、ほかは null
import assert from "node:assert/strict";
import { test } from "node:test";

import { LOGIN_ANNOUNCEMENTS, loginAnnouncementMessage } from "./loginAnnouncement";

test("loginAnnouncementMessage: 名前の知らせは文に", () => {
  assert.equal(loginAnnouncementMessage("alreadyRegistered"), "登録済みユーザーでログインしました");
  assert.equal(LOGIN_ANNOUNCEMENTS.alreadyRegistered, "登録済みユーザーでログインしました");
});

test("loginAnnouncementMessage: 省略・知らない名前・継いだ名前・文字列でない値は null(知らせない)", () => {
  for (const value of [undefined, null, "", "nope", "toString", 1, { alreadyRegistered: true }]) {
    assert.equal(loginAnnouncementMessage(value), null, String(value));
  }
});
