export type Product = {
  slug: string;
  name: string;
  category: "sod" | "seed" | "plugs";
  tagline: string;
  priceFrom: number;
  description: string;
  image: { src: string; alt: string };
  specs: {
    color: string;
    texture: string;
    wearTolerance: string;
    droughtTolerance: string;
    shadeTolerance: string;
    mowHeight: string;
  };
  stages: { label: string; detail: string }[];
  /** Upkeep required to keep the lawn looking its best — mowing/fertilizing frequency, not a quality rating. */
  maintenance: "low" | "medium" | "high";
  /** Which buying scenarios this product fits, used to filter recommendations. */
  bestFor: ("new-lawn" | "bare-spot-repair")[];
};

// Seed fixture for the Shopify test store (see scripts/seed-shopify.ts).
// The live catalog is fetched from Shopify via lib/shopify/catalog.ts;
// edit here and re-run `npm run seed:shopify` to change store data.
export const products: Product[] = [
  {
    slug: "horizon-bluegrass",
    name: "Horizon® Bluegrass",
    category: "sod",
    tagline: "A deep emerald variety bred for rapid recovery under heavy traffic",
    priceFrom: 229.99,
    description:
      "Horizon Bluegrass was developed for homeowners and turf managers who need a lawn that bounces back fast. Its dense root structure gives it standout wear tolerance for high-traffic yards, sports fields, and commercial grounds, while its rich emerald color holds through the growing season.",
    image: {
      src: "https://images.pexels.com/photos/139315/pexels-photo-139315.jpeg?auto=compress&cs=tinysrgb&w=1600",
      alt: "Dense, deep emerald bluegrass turf viewed from above",
    },
    specs: {
      color: "Deep Emerald Green",
      texture: "Medium-Fine",
      wearTolerance: "Excellent",
      droughtTolerance: "Very Good",
      shadeTolerance: "Good",
      mowHeight: "1.0–2.5 inches",
    },
    stages: [
      { label: "Install", detail: "Laid as fresh-cut sod, rooted within 10–14 days under regular watering." },
      { label: "Establish", detail: "Root system anchors fully by week 3, ready for light foot traffic." },
      { label: "Mature", detail: "Full color and density reached by week 6–8, ready for regular mowing routine." },
    ],
    maintenance: "medium",
    bestFor: ["new-lawn"],
  },
  {
    slug: "cascade-fescue",
    name: "Cascade® Fescue",
    category: "sod",
    tagline: "Shade-loving fescue blend built for cooler climates",
    priceFrom: 219.99,
    description:
      "Cascade Fescue is a tall fescue blend selected for its shade tolerance and cool-season resilience. It's a strong choice for yards with mature tree cover or northern-facing slopes where other varieties struggle.",
    image: {
      src: "https://images.pexels.com/photos/1770809/pexels-photo-1770809.jpeg?auto=compress&cs=tinysrgb&w=1600",
      alt: "Shaded lawn path beneath mature tree cover",
    },
    specs: {
      color: "Rich Green",
      texture: "Medium",
      wearTolerance: "Good",
      droughtTolerance: "Good",
      shadeTolerance: "Excellent",
      mowHeight: "2.5–3.5 inches",
    },
    stages: [
      { label: "Install", detail: "Sod rooted within 10–14 days; keep soil consistently moist." },
      { label: "Establish", detail: "Deep root development by week 4, tolerant of moderate shade by this stage." },
      { label: "Mature", detail: "Full shade tolerance and density by week 8." },
    ],
    maintenance: "medium",
    bestFor: ["new-lawn"],
  },
  {
    slug: "summit-ryegrass-seed",
    name: "Summit® Ryegrass Seed",
    category: "seed",
    tagline: "Fast-germinating seed for overseeding and quick repairs",
    priceFrom: 64.99,
    description:
      "Summit Ryegrass Seed germinates in as little as 5–7 days, making it ideal for overseeding thin lawns or repairing damaged patches before the next season begins.",
    image: {
      src: "https://images.pexels.com/photos/41831/pexels-photo-41831.jpeg?auto=compress&cs=tinysrgb&w=1600",
      alt: "Macro shot of a grass seed head against a green field",
    },
    specs: {
      color: "Bright Green",
      texture: "Fine",
      wearTolerance: "Good",
      droughtTolerance: "Fair",
      shadeTolerance: "Fair",
      mowHeight: "1.5–2.5 inches",
    },
    stages: [
      { label: "Germinate", detail: "Sprouts in 5–7 days with consistent moisture." },
      { label: "Establish", detail: "Root system develops over 3–4 weeks." },
      { label: "Mature", detail: "Full density by week 6, ready for normal mowing." },
    ],
    maintenance: "medium",
    bestFor: ["bare-spot-repair"],
  },
  {
    slug: "horizon-bluegrass-plugs",
    name: "Horizon® Bluegrass Plugs",
    category: "plugs",
    tagline: "72-count trays for spot repair and DIY lawn conversion",
    priceFrom: 84.99,
    description:
      "A cost-effective way to establish Horizon Bluegrass in small areas or repair damaged sections of an existing lawn. Each tray covers up to 72 square feet when spaced correctly.",
    image: {
      src: "https://images.pexels.com/photos/36403186/pexels-photo-36403186.jpeg?auto=compress&cs=tinysrgb&w=1600",
      alt: "Dew-covered bluegrass blades in vivid green",
    },
    specs: {
      color: "Deep Emerald Green",
      texture: "Medium-Fine",
      wearTolerance: "Excellent",
      droughtTolerance: "Very Good",
      shadeTolerance: "Good",
      mowHeight: "1.0–2.5 inches",
    },
    stages: [
      { label: "Plant", detail: "Plugs placed 6–18 inches apart depending on desired fill speed." },
      { label: "Root", detail: "Plugs anchor into soil within 2–3 weeks." },
      { label: "Spread", detail: "Full lawn fill-in typically achieved within one growing season." },
    ],
    maintenance: "medium",
    bestFor: ["bare-spot-repair"],
  },
  {
    slug: "latitude-zoysia",
    name: "Latitude® Zoysia",
    category: "sod",
    tagline: "Dense, low-maintenance zoysia for a tight, carpet-like lawn",
    priceFrom: 259.99,
    description:
      "Latitude Zoysia forms an unusually dense, fine-bladed turf that crowds out weeds naturally and needs less frequent mowing than most warm-season grasses. A strong pick for homeowners who want a premium look without a heavy maintenance schedule.",
    image: {
      src: "https://images.pexels.com/photos/413195/pexels-photo-413195.jpeg?auto=compress&cs=tinysrgb&w=1600",
      alt: "Tight, carpet-like zoysia turf viewed from above",
    },
    specs: {
      color: "Medium-Dark Green",
      texture: "Fine",
      wearTolerance: "Very Good",
      droughtTolerance: "Excellent",
      shadeTolerance: "Good",
      mowHeight: "0.75–1.5 inches",
    },
    stages: [
      { label: "Install", detail: "Rooted within 14–21 days; zoysia establishes more slowly than bermuda." },
      { label: "Establish", detail: "Full root anchoring by week 4–5." },
      { label: "Mature", detail: "Peak density reached by end of first full growing season." },
    ],
    maintenance: "low",
    bestFor: ["new-lawn"],
  },
  {
    slug: "latitude-zoysia-plugs",
    name: "Latitude® Zoysia Plugs",
    category: "plugs",
    tagline: "72-count trays for establishing zoysia without a full re-sod",
    priceFrom: 94.99,
    description:
      "Zoysia is slow to establish from seed, which makes plugs the practical way to introduce Latitude Zoysia into an existing lawn. Each tray covers up to 72 square feet when spaced correctly, gradually spreading into the dense, carpet-like turf zoysia is known for.",
    image: {
      src: "https://images.pexels.com/photos/582486/pexels-photo-582486.jpeg?auto=compress&cs=tinysrgb&w=1600",
      alt: "Dense, fine-bladed zoysia grass close-up",
    },
    specs: {
      color: "Medium-Dark Green",
      texture: "Fine",
      wearTolerance: "Very Good",
      droughtTolerance: "Excellent",
      shadeTolerance: "Good",
      mowHeight: "0.75–1.5 inches",
    },
    stages: [
      { label: "Plant", detail: "Plugs placed 6–18 inches apart depending on desired fill speed." },
      { label: "Root", detail: "Slower to anchor than bluegrass or fescue plugs, typically 3–4 weeks." },
      { label: "Spread", detail: "Fills in gradually over one to two growing seasons." },
    ],
    maintenance: "low",
    bestFor: ["bare-spot-repair"],
  },
  {
    slug: "coastal-centipede-seed",
    name: "Coastal® Centipede Seed",
    category: "seed",
    tagline: "Low-input seed variety for sandy, acidic coastal soils",
    priceFrom: 54.99,
    description:
      "Coastal Centipede Seed was selected for its tolerance of the sandy, low-fertility soils common along the coast. It needs less fertilizer and mowing than most lawn grasses, making it a favorite for low-maintenance yards.",
    image: {
      src: "https://images.pexels.com/photos/580900/pexels-photo-580900.jpeg?auto=compress&cs=tinysrgb&w=1600",
      alt: "Sunlit light-green lawn, low and easy-care",
    },
    specs: {
      color: "Light-Medium Green",
      texture: "Medium",
      wearTolerance: "Fair",
      droughtTolerance: "Good",
      shadeTolerance: "Fair",
      mowHeight: "1.0–2.0 inches",
    },
    stages: [
      { label: "Germinate", detail: "Sprouts in 10–21 days; slower to start than ryegrass." },
      { label: "Establish", detail: "Spreads via stolons over 6–8 weeks." },
      { label: "Mature", detail: "Full coverage typically by the second growing season." },
    ],
    maintenance: "low",
    bestFor: ["new-lawn"],
  },
  {
    slug: "cascade-fescue-plugs",
    name: "Cascade® Fescue Plugs",
    category: "plugs",
    tagline: "72-count trays for shade-area repair and conversion",
    priceFrom: 79.99,
    description:
      "A practical way to introduce Cascade Fescue into shaded sections of an existing lawn without a full re-sod. Each tray covers up to 72 square feet when spaced correctly.",
    image: {
      src: "https://images.pexels.com/photos/1423601/pexels-photo-1423601.jpeg?auto=compress&cs=tinysrgb&w=1600",
      alt: "Soft-focus close-up of fescue grass blades",
    },
    specs: {
      color: "Rich Green",
      texture: "Medium",
      wearTolerance: "Good",
      droughtTolerance: "Good",
      shadeTolerance: "Excellent",
      mowHeight: "2.5–3.5 inches",
    },
    stages: [
      { label: "Plant", detail: "Plugs placed 6–18 inches apart depending on desired fill speed." },
      { label: "Root", detail: "Anchors into soil within 2–3 weeks, faster in shaded/cooler soil." },
      { label: "Spread", detail: "Full fill-in typically within one growing season." },
    ],
    maintenance: "medium",
    bestFor: ["bare-spot-repair"],
  },
];

export type LawnPreferences = {
  sun?: "full-sun" | "shade";
  traffic?: "high" | "low";
  maintenance?: "low" | "best-appearance";
  goal?: "new-lawn" | "bare-spot-repair";
};

/**
 * Deterministic filter over the real catalog — never generated by the model.
 * Every exclusion is grounded in an explicit spec field so results can't drift
 * from what's actually in the catalog (now fetched from Shopify by callers).
 */
export function recommendProducts(prefs: LawnPreferences, catalog: Product[]): Product[] {
  return catalog.filter((p) => {
    if (prefs.sun === "shade" && !["Good", "Excellent"].includes(p.specs.shadeTolerance)) {
      return false;
    }
    if (prefs.traffic === "high" && p.specs.wearTolerance === "Fair") {
      return false;
    }
    if (prefs.maintenance === "low" && p.maintenance !== "low") {
      return false;
    }
    if (prefs.goal && !p.bestFor.includes(prefs.goal)) {
      return false;
    }
    return true;
  });
}

export type Guide = {
  slug: string;
  title: string;
  excerpt: string;
  body: string[];
  category: string;
  image: { src: string; alt: string };
};

export const guides: Guide[] = [
  {
    slug: "spring-lawn-checklist",
    title: "Your Spring Lawn Checklist",
    excerpt: "The five things to do the moment your lawn breaks winter dormancy.",
    category: "Seasonal Care",
    image: {
      src: "https://images.pexels.com/photos/6728933/pexels-photo-6728933.jpeg?auto=compress&cs=tinysrgb&w=1600",
      alt: "Mowing a lush green lawn in spring sunlight",
    },
    body: [
      "As soil temperatures climb past 55°F, warm-season grasses begin breaking dormancy — and the first few weeks of active growth set the tone for the rest of the season.",
      "Start with a light dethatching pass to remove the winter's dead material, then apply a balanced starter fertilizer once you see consistent green-up across at least 50% of the lawn.",
      "Hold off on pre-emergent herbicide if you plan to overseed — the two work against each other. Water deeply but infrequently to encourage deep root growth rather than shallow surface roots.",
    ],
  },
  {
    slug: "choosing-sod-vs-seed",
    title: "Sod vs. Seed: Which Is Right for Your Yard?",
    excerpt: "A practical breakdown of cost, timeline, and results for each approach.",
    category: "Buying Guides",
    image: {
      src: "https://images.pexels.com/photos/5231241/pexels-photo-5231241.jpeg?auto=compress&cs=tinysrgb&w=1600",
      alt: "Gardener carrying a strip of fresh-cut sod",
    },
    body: [
      "Sod gives you an established lawn in a single afternoon, at a higher upfront cost per square foot. It's the right call when you need immediate results — new construction, erosion-prone slopes, or a hard deadline like a home sale.",
      "Seed costs less and lets you fine-tune variety selection, but takes weeks to establish and is more vulnerable to weather, birds, and foot traffic during germination.",
      "For most homeowners without time pressure, seed is the more economical choice. For anyone needing a finished lawn fast, sod remains the more reliable option.",
    ],
  },
  {
    slug: "watering-newly-installed-sod",
    title: "Watering Newly Installed Sod: Week by Week",
    excerpt: "A simple watering schedule to get new sod rooted successfully.",
    category: "Seasonal Care",
    image: {
      src: "https://images.pexels.com/photos/25283561/pexels-photo-25283561.jpeg?auto=compress&cs=tinysrgb&w=1600",
      alt: "Sprinkler watering a lush green lawn in morning light",
    },
    body: [
      "Week one is the most critical — water new sod once or twice daily, enough to keep the soil beneath consistently moist without pooling on the surface.",
      "By week two, begin tapering to every other day as roots start anchoring into the soil below.",
      "By week three, most varieties can shift to a normal watering schedule of 1 inch per week, adjusted for local rainfall and soil type.",
    ],
  },
  {
    slug: "mowing-height-and-frequency",
    title: "Getting Mowing Height and Frequency Right",
    excerpt: "Why cutting too short is the most common lawn care mistake — and how to fix it.",
    category: "Maintenance",
    image: {
      src: "https://images.pexels.com/photos/4162011/pexels-photo-4162011.jpeg?auto=compress&cs=tinysrgb&w=1600",
      alt: "Lawn mower cutting a healthy green lawn",
    },
    body: [
      "Cutting grass too short weakens root development and opens the door to weeds and drought stress. As a rule, never remove more than one-third of the blade length in a single mow.",
      "Cool-season grasses like fescue and bluegrass generally do best at 2.5–3.5 inches, while warm-season varieties like zoysia can be kept lower, around 1–1.5 inches.",
      "Mow more frequently during peak growth in spring and fall, and raise the deck slightly during summer heat to help the lawn retain moisture and shade its own root zone.",
    ],
  },
];
