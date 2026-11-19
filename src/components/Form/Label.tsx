// src/components/Form/Label.tsx

import * as React from "react";

import { Label as PrimitiveLabel } from "@/components/Primitives/Label";

export type LabelProps = React.ComponentProps<typeof PrimitiveLabel>;

export function Label(props: LabelProps) {
  return <PrimitiveLabel {...props} />;
}
