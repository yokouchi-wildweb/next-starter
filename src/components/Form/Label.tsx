// src/components/Form/Label.tsx

import * as React from "react";

import { Label as ShadcnLabel } from "@/components/Shadcn/label";

export type LabelProps = React.ComponentProps<typeof ShadcnLabel>;

export function Label(props: LabelProps) {
  return <ShadcnLabel {...props} />;
}
