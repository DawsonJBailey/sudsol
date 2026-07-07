export type Pest = {
  slug: string;
  name: string;
  identification: string;
  damageSigns: string;
  controlSlug: string;
};

export const pests: Pest[] = [
  {
    slug: "chinch-bugs",
    name: "Chinch Bugs",
    identification:
      "Adults are tiny — roughly the size of a pen tip — with a dark body and a distinctive white band across the back; young nymphs are reddish with a pale stripe. They favor St. Augustine lawns and tend to cluster down at the thatch layer, which makes them easy to miss until damage is already visible.",
    damageSigns:
      "Damage often gets mistaken for drought stress: irregular yellow-to-brown patches, usually starting near sidewalks, driveways, or other hot, dry edges of the lawn.",
    controlSlug: "shieldpro-bifenthrin",
  },
  {
    slug: "sod-webworms",
    name: "Sod Webworms",
    identification:
      "The adult is a small tan moth, under an inch across, that lays eggs directly on grass blades. The larvae are the actual turf pest — pale green-brown caterpillars that feed on leaf tissue through late summer and fall.",
    damageSigns:
      "Grass blades take on a thin, see-through, 'skeletonized' look where the caterpillars have chewed through the surface layer.",
    controlSlug: "clearlawn-spinosad",
  },
  {
    slug: "fall-armyworms",
    name: "Fall Armyworms",
    identification:
      "Larger than sod webworm caterpillars, fall armyworms show a pale inverted 'Y' marking on the head capsule and grow to roughly 30–40mm. Outbreaks tend to show up quickly and spread across a lawn in a matter of days.",
    damageSigns:
      "Similar skeletonized, transparent patches as sod webworms, often appearing suddenly in small brown patches that expand fast.",
    controlSlug: "shieldpro-bifenthrin",
  },
  {
    slug: "white-grubs",
    name: "White Grubs",
    identification:
      "The larval stage of several beetle species (Japanese beetle, June beetle, and others). Grubs are C-shaped, cream-colored, with a brown head and six visible front legs.",
    damageSigns:
      "Damage happens underground first — grubs feed on roots, so affected turf pulls up loosely like a loose rug, and damage often peaks in late summer.",
    controlSlug: "depthguard-grub-control",
  },
  {
    slug: "hunting-billbugs",
    name: "Hunting Billbugs",
    identification:
      "A weevil with a long, curved snout and a smooth, dark Y-shaped mark on its back. Most common in zoysia and bermudagrass lawns.",
    damageSigns:
      "Irregular dead patches that look like drought stress. A simple check: tug on the dead grass — if it lifts easily with no root resistance, billbugs (rather than an irrigation issue) are the likely cause.",
    controlSlug: "shieldpro-bifenthrin",
  },
  {
    slug: "spittlebugs",
    name: "Spittlebugs",
    identification:
      "Small, dark, winged insects most common in centipedegrass, often revealing a bright red abdomen and two red stripes when the wings lift.",
    damageSigns:
      "A frothy, spit-like substance in the thatch layer, and thin purple or white streaking along individual grass blades.",
    controlSlug: "shieldpro-bifenthrin",
  },
  {
    slug: "mole-crickets",
    name: "Mole Crickets",
    identification:
      "Large — over an inch long — and built for digging, with shovel-like front legs adapted for tunneling just under the soil surface.",
    damageSigns:
      "Raised, spongy tunnel tracks through the lawn and small mounded soil openings, especially during spring mating season.",
    controlSlug: "depthguard-grub-control",
  },
];

export type ControlProduct = {
  slug: string;
  name: string;
  activeIngredient: string;
  price: number;
  description: string;
};

export const controlProducts: ControlProduct[] = [
  {
    slug: "shieldpro-bifenthrin",
    name: "ShieldPro Bifenthrin Concentrate",
    activeIngredient: "Bifenthrin",
    price: 49.99,
    description:
      "A broad-spectrum liquid concentrate effective against chinch bugs, billbugs, spittlebugs, and armyworms. Mixes with water for lawn-wide application.",
  },
  {
    slug: "clearlawn-spinosad",
    name: "ClearLawn Spinosad Spray",
    activeIngredient: "Spinosad",
    price: 34.99,
    description:
      "A ready-to-spray treatment targeted at lawn caterpillars like sod webworms, formulated for lower impact on beneficial insects.",
  },
  {
    slug: "depthguard-grub-control",
    name: "DepthGuard Grub Control Granules",
    activeIngredient: "Imidacloprid",
    price: 44.99,
    description:
      "A granular soil treatment for grub and mole cricket control, applied preventatively or at first signs of root-level damage.",
  },
];
