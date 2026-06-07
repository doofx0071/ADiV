/**
 * Achievement definitions for the AdiV motorcycle maintenance tracker.
 *
 * Shared between Convex server code and client UI.
 * DO NOT import Convex APIs in this file — it's imported by browser components.
 */
export const ACHIEVEMENT_DEFS = [
  {
    type: "first_service",
    name: "First Service",
    description: "Complete your first maintenance log",
    icon: "wrench",
  },
  {
    type: "streak_3",
    name: "On a Roll",
    description: "Complete 3 maintenance items on time",
    icon: "flame",
  },
  {
    type: "streak_10",
    name: "Maintenance Master",
    description: "Complete 10 maintenance items on time",
    icon: "award",
  },
  {
    type: "miles_100",
    name: "Century Rider",
    description: "Log 100 km in rides",
    icon: "route",
  },
  {
    type: "miles_1000",
    name: "Thousand K",
    description: "Log 1,000 km in rides",
    icon: "route",
  },
  {
    type: "miles_5000",
    name: "Long Haul",
    description: "Log 5,000 km in rides",
    icon: "route",
  },
  {
    type: "fuel_efficiency_30",
    name: "Eco Warrior",
    description: "Achieve 30 km/L fuel efficiency",
    icon: "fuel",
  },
  {
    type: "fuel_efficiency_40",
    name: "Hypermiler",
    description: "Achieve 40 km/L fuel efficiency",
    icon: "fuel",
  },
  {
    type: "photo_logger",
    name: "Photo Journalist",
    description: "Attach photos to 5 maintenance logs",
    icon: "camera",
  },
  {
    type: "expense_tracker",
    name: "Bean Counter",
    description: "Log 10 expenses",
    icon: "wallet",
  },
] as const;

export type AchievementType = (typeof ACHIEVEMENT_DEFS)[number]["type"];
