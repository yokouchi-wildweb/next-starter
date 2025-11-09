// src/features/card/services/server/cardService.ts

import { base } from "./drizzleBase";
import { listWithTitle } from "./wrappers/listWithTitle";
import { search } from "./wrappers/search";
import { create } from "./wrappers/create";
import { update } from "./wrappers/update";
import { get } from "./wrappers/get";
import { remove } from "./wrappers/remove";

export const cardService = {
  ...base,
  listWithTitle,
  search,
  create,
  update,
  get,
  remove,
};
