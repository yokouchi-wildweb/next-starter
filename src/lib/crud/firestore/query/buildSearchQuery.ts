import type { SearchParams, CreateCrudServiceOptions } from "../../types";
import { applyWhere } from "./applyWhere";

export const buildSearchQuery = (
  col: FirebaseFirestore.CollectionReference,
  params: SearchParams = {},
  options: CreateCrudServiceOptions = {},
): FirebaseFirestore.Query => {
  const {
    page = 1,
    limit = 100,
    orderBy = options.defaultOrderBy,
    searchQuery,
    searchFields = options.defaultSearchFields,
    where,
  } = params;

  let q: FirebaseFirestore.Query = col;
  q = applyWhere(q, where);
  if (searchQuery && searchFields && searchFields.length) {
    const field = searchFields[0];
    q = q
      .where(field, ">=", searchQuery)
      .where(field, "<=", searchQuery + "\uf8ff");
  }
  if (orderBy && orderBy.length) {
    const [field, dir] = orderBy[0];
    q = q.orderBy(field, dir === "ASC" ? "asc" : "desc");
  }
  const fetchLimit = limit ? page * limit : undefined;
  if (fetchLimit) q = q.limit(fetchLimit);
  return q;
};

