import type { WhereExpr } from "../../types";

export const applyWhere = (
  q: FirebaseFirestore.Query,
  expr?: WhereExpr,
): FirebaseFirestore.Query => {
  if (!expr) return q;
  if ("field" in expr) {
    const value = expr.value;
    switch (expr.op) {
      case "eq":
        return q.where(expr.field, "==", value);
      case "ne":
        return q.where(expr.field, "!=", value);
      case "lt":
        return q.where(expr.field, "<", value);
      case "lte":
        return q.where(expr.field, "<=", value);
      case "gt":
        return q.where(expr.field, ">", value);
      case "gte":
        return q.where(expr.field, ">=", value);
      case "like":
        return q
          .where(expr.field, ">=", value)
          .where(expr.field, "<=", String(value) + "\uf8ff");
    }
  } else if ("and" in expr) {
    return expr.and.reduce((acc, e) => applyWhere(acc, e), q);
  } else if ("or" in expr) {
    throw new Error("Firestore search does not support OR queries");
  }
  return q;
};

