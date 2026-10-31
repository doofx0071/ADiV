import { ConvexReactClient } from "convex/react";

export const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;
export const convexClient = convexUrl ? new ConvexReactClient(convexUrl) : null;
