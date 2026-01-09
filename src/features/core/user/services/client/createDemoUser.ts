// src/features/user/services/client/createDemoUser.ts

"use client";

import axios from "axios";

import type { User } from "@/features/core/user/entities";
import type { CreateDemoUserInput } from "../types";
import { normalizeHttpError } from "@/lib/errors";

const ENDPOINT = "/api/admin/user/demo/create";

export async function createDemoUser(data: CreateDemoUserInput): Promise<User> {
  try {
    const response = await axios.post<User>(ENDPOINT, data);
    return response.data;
  } catch (error) {
    throw normalizeHttpError(error, "デモユーザーの作成に失敗しました");
  }
}
