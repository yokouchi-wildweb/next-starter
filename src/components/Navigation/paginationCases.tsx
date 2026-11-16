// Pagination の makeHref の出力を比べる場合の一覧(render テストと期待値の記録で同じ物を使う)
import { createElement, type ReactElement } from "react";

import Pagination from "@/components/Navigation/Pagination";

const makeHref = (p: number) => `/list?page=${p}`;

export const paginationHrefCases: Record<string, ReactElement> = {
  first: createElement(Pagination, { page: 1, perPage: 20, total: 205, makeHref }),
  middle: createElement(Pagination, { page: 6, perPage: 20, total: 205, makeHref }),
  last: createElement(Pagination, { page: 11, perPage: 20, total: 205, makeHref }),
  single: createElement(Pagination, { page: 1, perPage: 20, total: 7, makeHref }),
  empty: createElement(Pagination, { page: 1, perPage: 20, total: 0, makeHref }),
  outOfRange: createElement(Pagination, { page: 99, perPage: 20, total: 45, makeHref }),
  pageJump: createElement(Pagination, { page: 3, perPage: 10, total: 95, makeHref, usePageJump: true }),
};
