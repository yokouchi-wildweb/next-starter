// src/types/params.ts

export type RouteParams<T extends object> = { params: Promise<T> };

export type DomainParams = RouteParams<{ domain: string }>;

export type DomainIdParams = RouteParams<{ domain: string; id: string }>;
