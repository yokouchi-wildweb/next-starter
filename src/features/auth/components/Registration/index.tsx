// src/features/auth/components/Registration/index.tsx

"use client";

import type { ComponentType } from "react";

import { OAuthRegistrationForm } from "./OAuth"
import { EmailRegistrationForm } from "./Email";
import { UnknownRegistrationForm } from "./UnknownRegistrationForm";

export type RegistrationMethod = "email" | "thirdParty";

export type RegistrationFormProps = {
  method?: RegistrationMethod;
};

const registrationComponentMap: Record<RegistrationMethod, ComponentType> = {
  email: EmailRegistrationForm,
  thirdParty: OAuthRegistrationForm,
};

export function Registration({ method = "email" }: RegistrationFormProps) {

  const Component = registrationComponentMap[method] ?? UnknownRegistrationForm;

  return <Component />;
}
