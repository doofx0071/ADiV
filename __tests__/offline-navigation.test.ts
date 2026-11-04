import { describe, expect, it, vi } from "vitest";
vi.mock("../mobile/src/lib/mapbox-bridge", () => ({
  isMapboxAndroidReady: () => false,
  requestMapboxRoute: async () => { throw new Error("Mapbox bridge should not be called by these pure routing tests."); },
}));
import {
  OFF_ROUTE_CONFIRMATION_FIXES,
  OFF_ROUTE_DISTANCE_METERS,
  REROUTE_COOLDOWN_MS,
  distanceToRouteMeters,
  updateRerouteHysteresis,
  type RerouteHysteresisState,
} from "../mobile/src/lib/navigation";

describe("online reroute hysteresis", () => {
  it("waits for consecutive off-route GPS fixes and respects cooldown", () => {
    let state: RerouteHysteresisState = { consecutiveOffRouteFixes: 0, lastRerouteAt: 0 };
    const offRoute = OFF_ROUTE_DISTANCE_METERS + 1;
    const first = updateRerouteHysteresis(state, offRoute, REROUTE_COOLDOWN_MS + 1);
    state = first.state;
    expect(first.shouldReroute).toBe(false);
    const second = updateRerouteHysteresis(state, offRoute, REROUTE_COOLDOWN_MS + 2);
    state = second.state;
    expect(second.shouldReroute).toBe(false);
    const third = updateRerouteHysteresis(state, offRoute, REROUTE_COOLDOWN_MS + 3);
    state = third.state;
    expect(third.shouldReroute).toBe(true);
    expect(state.lastRerouteAt).toBe(REROUTE_COOLDOWN_MS + 3);
    expect(OFF_ROUTE_CONFIRMATION_FIXES).toBe(3);

    const duringCooldown = updateRerouteHysteresis(state, offRoute, state.lastRerouteAt + 1);
    expect(duringCooldown.shouldReroute).toBe(false);
    expect(duringCooldown.state.consecutiveOffRouteFixes).toBe(1);
    expect(updateRerouteHysteresis(duringCooldown.state, 0, state.lastRerouteAt + 2).state.consecutiveOffRouteFixes).toBe(0);
  });

  it("measures distance from a GPS point to a planned route", () => {
    expect(distanceToRouteMeters([125.001, 7], [[125, 7], [125.002, 7]])).toBeLessThan(1);
    expect(distanceToRouteMeters([125.001, 7.002], [[125, 7], [125.002, 7]])).toBeGreaterThan(200);
    expect(distanceToRouteMeters([125, 7], [])).toBe(Number.POSITIVE_INFINITY);
  });
});
