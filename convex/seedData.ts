/**
 * Honda ADV160 — Official Maintenance Schedule (Seed Data)
 *
 * Sources: Honda ADV160 Owner's Manual, Service Manual
 * Intervals follow the official Honda recommendations.
 *
 * intervalKm: kilometer-based interval (undefined = time-only service).
 * intervalMonths: time-based interval (always specified).
 */
export interface SeedMaintenanceItem {
  name: string;
  category: string;
  intervalKm?: number;
  intervalMonths: number;
  description: string;
  serviceLevel: string;
  notes?: string;
}

export const SEED_MAINTENANCE_ITEMS: SeedMaintenanceItem[] = [
  // ── Engine ────────────────────────────────────────────────────────
  {
    name: "Engine Oil",
    category: "engine",
    intervalKm: 6000,
    intervalMonths: 12,
    description: "Drain and replace engine oil with recommended grade.",
    serviceLevel: "dealer",
    notes: "Use Honda GN4 10W-30 or equivalent JASO MA2. Capacity: ~0.9L with filter change.",
  },
  {
    name: "Oil Filter",
    category: "engine",
    intervalKm: 6000,
    intervalMonths: 12,
    description: "Replace oil filter cartridge.",
    serviceLevel: "dealer",
    notes: "Replace every other oil change if using high-quality filter. Always replace with oil change.",
  },
  {
    name: "Spark Plug",
    category: "engine",
    intervalKm: 12000,
    intervalMonths: 12,
    description: "Replace spark plug and check gap.",
    serviceLevel: "dealer",
    notes: "NGK CPR8EA-9 or equivalent. Gap: 0.8–0.9 mm.",
  },
  {
    name: "Valve Clearance",
    category: "engine",
    intervalKm: 12000,
    intervalMonths: 12,
    description: "Inspect and adjust valve clearance.",
    serviceLevel: "dealer",
    notes: "Requires feeler gauge. Intake: 0.16±0.03mm, Exhaust: 0.27±0.03mm.",
  },
  {
    name: "Idle Speed",
    category: "engine",
    intervalKm: 6000,
    intervalMonths: 12,
    description: "Check and adjust idle speed.",
    serviceLevel: "dealer",
    notes: "Idle speed: 1400±100 RPM (warm engine).",
  },
  {
    name: "Oil Strainer Screen",
    category: "engine",
    intervalKm: 12000,
    intervalMonths: 12,
    description: "Clean oil strainer screen.",
    serviceLevel: "dealer",
    notes: "Inspect for debris during cleaning. Replace if damaged.",
  },
  {
    name: "Crankcase Breather",
    category: "engine",
    intervalKm: 12000,
    intervalMonths: 12,
    description: "Clean crankcase breather tube and check valve.",
    serviceLevel: "dealer",
    notes: "Ensure tube is not clogged. Replace if cracked or brittle.",
  },

  // ── Transmission ──────────────────────────────────────────────────
  {
    name: "Drive Belt (V-Belt)",
    category: "transmission",
    intervalKm: 12000,
    intervalMonths: 12,
    description: "Inspect and replace drive belt if worn.",
    serviceLevel: "dealer",
    notes: "Check for cracks, fraying, or glazing. Replace every 12,000 km or sooner if damaged.",
  },
  {
    name: "Rollers / Slide Piece",
    category: "transmission",
    intervalKm: 6000,
    intervalMonths: 12,
    description: "Inspect CVT rollers and slide pieces for wear.",
    serviceLevel: "dealer",
    notes: "Replace if flat spots, uneven wear, or diameter below service limit.",
  },
  {
    name: "Final Drive Oil",
    category: "transmission",
    intervalMonths: 24,
    description: "Drain and replace final drive gear oil.",
    serviceLevel: "dealer",
    notes: "Use SAE 80W-90 GL-4 gear oil. Capacity: ~110 mL.",
  },
  {
    name: "Clutch Shoes Wear",
    category: "transmission",
    intervalKm: 12000,
    intervalMonths: 12,
    description: "Inspect clutch shoe thickness and spring tension.",
    serviceLevel: "dealer",
    notes: "Replace if lining thickness is below service limit or if slipping occurs.",
  },

  // ── Brakes ────────────────────────────────────────────────────────
  {
    name: "Brake System",
    category: "brakes",
    intervalKm: 6000,
    intervalMonths: 12,
    description: "Inspect brake pads, discs, fluid level, and lines.",
    serviceLevel: "owner",
    notes: "Check pad thickness, disc runout, fluid level. Replace fluid every 2 years (24 months).",
  },

  // ── Tires ─────────────────────────────────────────────────────────
  {
    name: "Tires",
    category: "tires",
    intervalKm: 1000,
    intervalMonths: 1,
    description: "Check tire pressure, tread depth, and sidewall condition.",
    serviceLevel: "owner",
    notes: "Front: 200 kPa (29 psi). Rear: 225 kPa (33 psi). Minimum tread depth: 1.6 mm.",
  },

  // ── Electrical ────────────────────────────────────────────────────
  {
    name: "Battery",
    category: "electrical",
    intervalKm: 6000,
    intervalMonths: 12,
    description: "Check battery terminals, electrolyte level, and charge.",
    serviceLevel: "owner",
    notes: "Maintain terminal cleanliness. Refill with distilled water if low. Charge if voltage < 12.4V.",
  },
  {
    name: "Lights, Signals & Horn",
    category: "electrical",
    intervalKm: 6000,
    intervalMonths: 12,
    description: "Check operation of headlight, taillight, turn signals, and horn.",
    serviceLevel: "owner",
    notes: "Replace any non-working bulbs. Check for cracked lenses.",
  },

  // ── Cooling ───────────────────────────────────────────────────────
  {
    name: "Coolant",
    category: "cooling",
    intervalMonths: 36,
    description: "Drain, flush, and replace engine coolant.",
    serviceLevel: "dealer",
    notes: "Use Honda HP Coolant or ethylene glycol based. Capacity: ~0.6L. Dispose of old coolant properly.",
  },
  {
    name: "Cooling System",
    category: "cooling",
    intervalKm: 6000,
    intervalMonths: 12,
    description: "Inspect radiator, hoses, fan operation, and coolant level.",
    serviceLevel: "dealer",
    notes: "Check for leaks, fan activates at ~100°C. Replace hoses if cracked or swollen.",
  },

  // ── Fuel ──────────────────────────────────────────────────────────
  {
    name: "Fuel System (Injector)",
    category: "fuel",
    intervalKm: 12000,
    intervalMonths: 12,
    description: "Inspect and clean fuel injector.",
    serviceLevel: "dealer",
    notes: "Use fuel system cleaner or ultrasonic cleaning. Check injector seal.",
  },
  {
    name: "Fuel Line",
    category: "fuel",
    intervalKm: 6000,
    intervalMonths: 12,
    description: "Inspect fuel lines for cracks, leakage, or deterioration.",
    serviceLevel: "dealer",
    notes: "Replace if any cracks or hardening detected. Check all clamps are tight.",
  },

  // ── General ───────────────────────────────────────────────────────
  {
    name: "Air Cleaner Element",
    category: "general",
    intervalKm: 12000,
    intervalMonths: 12,
    description: "Replace air cleaner element.",
    serviceLevel: "dealer",
    notes: "Inspect more frequently in dusty conditions. Never use compressed air to clean.",
  },
  {
    name: "Throttle Operation",
    category: "general",
    intervalKm: 6000,
    intervalMonths: 12,
    description: "Check throttle grip free play and smooth operation.",
    serviceLevel: "owner",
    notes: "Free play: 2–6 mm. Lubricate cable if stiff. Ensure smooth return.",
  },

  // ── Chassis ───────────────────────────────────────────────────────
  {
    name: "Side Stand",
    category: "chassis",
    intervalKm: 6000,
    intervalMonths: 12,
    description: "Lubricate side stand pivot and check spring tension.",
    serviceLevel: "owner",
    notes: "Ensure stand retracts fully. Replace spring if weak.",
  },
  {
    name: "Suspension",
    category: "chassis",
    intervalKm: 12000,
    intervalMonths: 12,
    description: "Inspect front forks and rear shock for leaks and operation.",
    serviceLevel: "dealer",
    notes: "Check fork seal condition, damping response. Change fork oil if leaking.",
  },
  {
    name: "Nuts & Bolts",
    category: "chassis",
    intervalKm: 12000,
    intervalMonths: 12,
    description: "Check tightness of chassis fasteners and safety-critical bolts.",
    serviceLevel: "owner",
    notes: "Pay special attention to engine mounts, brake caliper bolts, axle nuts, and handlebar clamps.",
  },
  {
    name: "Steering Head Bearings",
    category: "chassis",
    intervalKm: 24000,
    intervalMonths: 24,
    description: "Inspect, clean, and repack steering head bearings.",
    serviceLevel: "dealer",
    notes: "Check for notchiness. Replace if pitted or worn. Apply lithium soap grease.",
  },
];
