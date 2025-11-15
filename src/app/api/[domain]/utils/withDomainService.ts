import { NextResponse } from "next/server";

import { isDomainError } from "@/lib/errors";
import { serviceRegistry } from "@/registry/serviceRegistry";

export type WithDomainServiceContext<TService, TParams extends { domain: string }> = {
  service: TService;
  params: TParams;
  domain: string;
};

export type WithDomainServiceOptions<TService, TResult, TParams extends { domain: string }> = {
  supports?: keyof TService | Array<keyof TService>;
  onBadRequest?: (
    error: unknown,
    context: WithDomainServiceContext<TService, TParams>,
  ) => NextResponse | void;
  onSuccess?: (
    result: TResult,
    context: WithDomainServiceContext<TService, TParams>,
  ) => NextResponse;
  operation?: string;
};

const services = serviceRegistry;

function ensureSupports<TService>(service: TService, supports?: WithDomainServiceOptions<TService, unknown, any>["supports"]) {
  if (!supports) return true;
  const methods = Array.isArray(supports) ? supports : [supports];
  return methods.every((method) => typeof (service as Record<PropertyKey, unknown>)[method] === "function");
}

export async function withDomainService<
  TService = any,
  TResult = unknown,
  TParams extends { domain: string } = { domain: string },
>(
  paramsPromise: Promise<TParams>,
  handler: (
    service: TService,
    context: WithDomainServiceContext<TService, TParams>,
  ) => Promise<TResult>,
  options: WithDomainServiceOptions<TService, TResult, TParams> = {},
) : Promise<NextResponse> {
  const params = await paramsPromise;
  const { domain } = params;
  const service = services[domain] as TService | undefined;

  if (!service) {
    return new NextResponse("Not Found", { status: 404 });
  }

  if (!ensureSupports(service, options.supports)) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const context: WithDomainServiceContext<TService, TParams> = { service, params, domain };
  const operation = options.operation ?? "Domain API handler";

  try {
    const result = await handler(service, context);
    if (result instanceof NextResponse) {
      return result;
    }
    if (options.onSuccess) {
      return options.onSuccess(result, context);
    }
    return NextResponse.json(result ?? null);
  } catch (error) {
    console.error(`${operation} failed (domain: ${domain}):`, error);

    if (options.onBadRequest) {
      const response = options.onBadRequest(error, context);
      if (response) return response;
    }

    if (isDomainError(error)) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    if (error instanceof Error && error.message) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
