/**
 * Achievement definitions for the AdiV motorcycle maintenance tracker.
 *
 * Shared between Convex server code and client UI.
 * DO NOT import Convex APIs in this file — it's imported by browser components.
 *
 * `target` is the unlock threshold for the metric behind each badge;
 * `unit` tells the UI how to render progress values.
 */
export const ACHIEVEMENT_DEFS = [
  {
    type: "first_service",
    name: "First Service",
    description: "Complete your first maintenance log",
    icon: "wrench",
    target: 1,
    unit: "count",
  },
  {
    type: "streak_3",
    name: "On a Roll",
    description: "3 consecutive on-time maintenance services",
    icon: "flame",
    target: 3,
    unit: "count",
  },
  {
    type: "streak_5",
    name: "Maintenance Pro",
    description: "5 consecutive on-time maintenance services",
    icon: "flame",
    target: 5,
    unit: "count",
  },
  {
    type: "streak_10",
    name: "Maintenance Master",
    description: "10 consecutive on-time maintenance services",
    icon: "award",
    target: 10,
    unit: "count",
  },
  {
    type: "miles_100",
    name: "Century Rider",
    description: "Log 100 km in rides",
    icon: "route",
    target: 100,
    unit: "km",
  },
  {
    type: "miles_1000",
    name: "Thousand K",
    description: "Log 1,000 km in rides",
    icon: "route",
    target: 1000,
    unit: "km",
  },
  {
    type: "miles_5000",
    name: "Long Haul",
    description: "Log 5,000 km in rides",
    icon: "route",
    target: 5000,
    unit: "km",
  },
  {
    type: "mileage_10k",
    name: "10K Club",
    description: "Log 10,000 km in rides",
    icon: "route",
    target: 10000,
    unit: "km",
  },
  {
    type: "mileage_25k",
    name: "25K Club",
    description: "Log 25,000 km in rides",
    icon: "route",
    target: 25000,
    unit: "km",
  },
  {
    type: "fuel_efficiency_25",
    name: "Eco Rider",
    description: "Achieve 25 km/L fuel efficiency",
    icon: "fuel",
    target: 25,
    unit: "km/L",
  },
  {
    type: "fuel_efficiency_30",
    name: "Eco Warrior",
    description: "Achieve 30 km/L fuel efficiency",
    icon: "fuel",
    target: 30,
    unit: "km/L",
  },
  {
    type: "fuel_efficiency_40",
    name: "Hypermiler",
    description: "Achieve 40 km/L fuel efficiency",
    icon: "fuel",
    target: 40,
    unit: "km/L",
  },
  {
    type: "photo_logger",
    name: "Photo Journalist",
    description: "Attach photos to 5 maintenance logs",
    icon: "camera",
    target: 5,
    unit: "count",
  },
  {
    type: "expense_tracker",
    name: "Bean Counter",
    description: "Log 10 expenses",
    icon: "wallet",
    target: 10,
    unit: "count",
  },
  {
    type: "diy_mechanic",
    name: "DIY Mechanic",
    description: "Log 10 maintenance services",
    icon: "gauge",
    target: 10,
    unit: "count",
  },
  {
    type: "big_spender",
    name: "Invested",
    description: "Log ₱50,000 in total expenses",
    icon: "banknote",
    target: 50000,
    unit: "currency",
  },
  {
    type: "early_bird",
    name: "Ahead of the Game",
    description: "Log a service 500 km before it was due",
    icon: "sunrise",
    target: 1,
    unit: "count",
  },
] as const;

export type AchievementType = (typeof ACHIEVEMENT_DEFS)[number]["type"];
export type AchievementUnit = (typeof ACHIEVEMENT_DEFS)[number]["unit"];
