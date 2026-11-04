import { useGlobalSearchParams } from "expo-router";
import { useQuery, type OptionalRestArgsOrSkip } from "convex/react";
import type { FunctionReference, FunctionReturnType } from "convex/server";

/** Keep every mounted Convex subscription paused while the local share route is open. */
export function useShareSafeQuery<Query extends FunctionReference<"query">>(
  query: Query,
  ...args: OptionalRestArgsOrSkip<Query>
): FunctionReturnType<Query> | undefined {
  const { rideId } = useGlobalSearchParams<{ rideId?: string }>();
  const safeArgs: OptionalRestArgsOrSkip<Query> = rideId ? ["skip"] : args;
  return useQuery(query, ...safeArgs);
}
