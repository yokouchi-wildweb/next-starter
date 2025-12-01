// src/features/foo/hooks/useCreateFoo.ts

"use client";

import { useCreateDomain } from "@/lib/crud/hooks";
import { fooClient } from "../services/client/fooClient";
import type { Foo } from "../entities";
import type { FooCreateFields } from "../entities/form";

export const useCreateFoo = () =>
  useCreateDomain<Foo, FooCreateFields>("fooes/create", fooClient.create, "fooes");
