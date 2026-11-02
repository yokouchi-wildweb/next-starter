// domain/plural.mjs の toPlural: 語の規則は pluralize に任せ、最後の語だけを複数形にする（区切り・大文字小文字はそのまま）
import { test } from "node:test";
import assert from "node:assert/strict";

import { toPlural } from "../domain/plural.mjs";

const cases = [
  // 単語
  ["box", "boxes"],
  ["status", "statuses"],
  ["person", "people"],
  ["data", "data"],
  ["media", "media"],
  ["category", "categories"],
  ["key", "keys"],
  ["user", "users"],
  // snake / kebab の複合語（最後の語だけ）
  ["card_set", "card_sets"],
  ["user_category", "user_categories"],
  ["user_media", "user_media"],
  ["user_person", "user_people"],
  ["sample-tag", "sample-tags"],
  // camel / Pascal の複合語（最後の語だけ、大文字小文字は元のまま）
  ["cardSet", "cardSets"],
  ["sampleCategory", "sampleCategories"],
  ["userMedia", "userMedia"],
  ["userPerson", "userPeople"],
  ["CardSet", "CardSets"],
  ["Person", "People"],
  ["SampleStatus", "SampleStatuses"],
];

for (const [input, expected] of cases) {
  test(`toPlural(${input}) = ${expected}`, () => {
    assert.equal(toPlural(input), expected);
  });
}

test("空文字はそのまま返す", () => {
  assert.equal(toPlural(""), "");
});
