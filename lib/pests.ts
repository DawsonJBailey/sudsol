export type Pest = {
  slug: string;
  name: string;
  identification: string;
  damageSigns: string;
  controlSlug: string;
  // Optional caption shown under the photo on the guide page — use it when the
  // pictured life stage isn't the one that damages turf (e.g. adult moth vs larva).
  image: { src: string; alt: string; caption?: string };
  // Filename (in public/pest-examples/) of a photo showing this pest's damage
  // pattern on turf. Sent to the vision model as a labeled few-shot reference
  // so it can match a customer's lawn photo against real damage examples.
  damageExample?: { file: string; alt: string };
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
    image: {
      src: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Hairy_Chinch_Bug_-_Blissus_leucopteru_%2850594763067%29.jpg/960px-Hairy_Chinch_Bug_-_Blissus_leucopteru_%2850594763067%29.jpg",
      alt: "Close-up of a hairy chinch bug (Blissus leucopterus) on a blade of grass",
    },
    damageExample: {
      file: "chinch-bugs-damage.jpg",
      alt: "Lawn with irregular yellow-to-brown patches, resembling drought stress, from chinch bug feeding",
    },
  },
  {
    slug: "sod-webworms",
    name: "Sod Webworms",
    identification:
      "The adult is a small tan moth, under an inch across, that lays eggs directly on grass blades. The larvae are the actual turf pest — pale green-brown caterpillars that feed on leaf tissue through late summer and fall.",
    damageSigns:
      "Grass blades take on a thin, see-through, 'skeletonized' look where the caterpillars have chewed through the surface layer.",
    controlSlug: "clearlawn-spinosad",
    image: {
      src: "/pests/sod-webworms-larva.jpg",
      alt: "A pale sod webworm caterpillar with rows of dark spots, curled in lawn thatch",
      caption: "The larva is the turf-damaging stage — adults are small tan moths",
    },
    damageExample: {
      file: "sod-webworms-damage.jpg",
      alt: "Turf with thin, brown, skeletonized patches where sod webworm caterpillars have chewed through the grass blades",
    },
  },
  {
    slug: "fall-armyworms",
    name: "Fall Armyworms",
    identification:
      "Larger than sod webworm caterpillars, fall armyworms show a pale inverted 'Y' marking on the head capsule and grow to roughly 30–40mm. Outbreaks tend to show up quickly and spread across a lawn in a matter of days.",
    damageSigns:
      "Similar skeletonized, transparent patches as sod webworms, often appearing suddenly in small brown patches that expand fast.",
    controlSlug: "shieldpro-bifenthrin",
    image: {
      src: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Spodoptera_frugiperda_caterpillar01.jpg/960px-Spodoptera_frugiperda_caterpillar01.jpg",
      alt: "A fall armyworm caterpillar (Spodoptera frugiperda) on plant tissue",
    },
    damageExample: {
      file: "fall-armyworms-damage.jpg",
      alt: "Lawn with brown, scalped patches that appeared suddenly and spread from fall armyworm feeding",
    },
  },
  {
    slug: "white-grubs",
    name: "White Grubs",
    identification:
      "The larval stage of several beetle species (Japanese beetle, June beetle, and others). Grubs are C-shaped, cream-colored, with a brown head and six visible front legs.",
    damageSigns:
      "Damage happens underground first — grubs feed on roots, so affected turf pulls up loosely like a loose rug, and damage often peaks in late summer.",
    controlSlug: "depthguard-grub-control",
    image: {
      src: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/White_grub.jpg/960px-White_grub.jpg",
      alt: "A C-shaped white grub, the larval stage of a turf-damaging beetle",
    },
    damageExample: {
      file: "white-grubs-damage.jpg",
      alt: "Dead lawn patch where turf lifts loosely like a rug because white grubs have eaten the roots",
    },
  },
  {
    slug: "hunting-billbugs",
    name: "Hunting Billbugs",
    identification:
      "A weevil with a long, curved snout and a smooth, dark Y-shaped mark on its back. Most common in zoysia and bermudagrass lawns.",
    damageSigns:
      "Irregular dead patches that look like drought stress. A simple check: tug on the dead grass — if it lifts easily with no root resistance, billbugs (rather than an irrigation issue) are the likely cause.",
    controlSlug: "shieldpro-bifenthrin",
    image: {
      src: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Nutgrass_Billbug_-_Sphenophorus_cariosus%2C_Meadowood_Farm%2C_Mason_Neck%2C_Virginia.jpg/960px-Nutgrass_Billbug_-_Sphenophorus_cariosus%2C_Meadowood_Farm%2C_Mason_Neck%2C_Virginia.jpg",
      alt: "A billbug weevil (Sphenophorus sp.) showing its characteristic long snout",
    },
    damageExample: {
      file: "hunting-billbugs-damage.jpg",
      alt: "Irregular dead, drought-like patches in turf from hunting billbug damage, where dead grass lifts with no root resistance",
    },
  },
  {
    slug: "spittlebugs",
    name: "Spittlebugs",
    identification:
      "Small, dark, winged insects most common in centipedegrass, often revealing a bright red abdomen and two red stripes when the wings lift.",
    damageSigns:
      "A frothy, spit-like substance in the thatch layer, and thin purple or white streaking along individual grass blades.",
    controlSlug: "shieldpro-bifenthrin",
    image: {
      src: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Two-Lined_Spittlebug.jpg/960px-Two-Lined_Spittlebug.jpg",
      alt: "A two-lined spittlebug (Prosapia bicincta) showing its dark body with two red stripes",
    },
    damageExample: {
      file: "spittlebugs-damage.jpg",
      alt: "Grass with frothy, spit-like masses in the thatch and thin purple or white streaking on the blades from spittlebugs",
    },
  },
  {
    slug: "mole-crickets",
    name: "Mole Crickets",
    identification:
      "Large — over an inch long — and built for digging, with shovel-like front legs adapted for tunneling just under the soil surface.",
    damageSigns:
      "Raised, spongy tunnel tracks through the lawn and small mounded soil openings, especially during spring mating season.",
    controlSlug: "depthguard-grub-control",
    image: {
      src: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Southern_Mole_Cricket_-_Scapteriscus_borellii%2C_Sapelo_Island%2C_Georgia.jpg/960px-Southern_Mole_Cricket_-_Scapteriscus_borellii%2C_Sapelo_Island%2C_Georgia.jpg",
      alt: "A southern mole cricket (Scapteriscus borellii) showing its shovel-like digging legs",
    },
    damageExample: {
      file: "mole-crickets-damage.jpg",
      alt: "Lawn with raised, spongy tunnel tracks and small mounds of pushed-up soil from mole cricket tunneling",
    },
  },
];

export type ControlProduct = {
  slug: string;
  name: string;
  activeIngredient: string;
  price: number;
  description: string;
  image: { src: string; alt: string };
};

export const controlProducts: ControlProduct[] = [
  {
    slug: "shieldpro-bifenthrin",
    name: "ShieldPro Bifenthrin Concentrate",
    activeIngredient: "Bifenthrin",
    price: 49.99,
    description:
      "A broad-spectrum liquid concentrate effective against chinch bugs, billbugs, spittlebugs, and armyworms. Mixes with water for lawn-wide application.",
    image: {
      src: "https://images.pexels.com/photos/4894608/pexels-photo-4894608.jpeg?auto=compress&cs=tinysrgb&w=1600",
      alt: "Person in protective gear applying liquid pesticide concentrate with a pump sprayer",
    },
  },
  {
    slug: "clearlawn-spinosad",
    name: "ClearLawn Spinosad Spray",
    activeIngredient: "Spinosad",
    price: 34.99,
    description:
      "A ready-to-spray treatment targeted at lawn caterpillars like sod webworms, formulated for lower impact on beneficial insects.",
    image: {
      src: "https://images.pexels.com/photos/13882449/pexels-photo-13882449.jpeg?auto=compress&cs=tinysrgb&w=1600",
      alt: "Person using a backpack sprayer to apply treatment across a green lawn",
    },
  },
  {
    slug: "depthguard-grub-control",
    name: "DepthGuard Grub Control Granules",
    activeIngredient: "Imidacloprid",
    price: 44.99,
    description:
      "A granular soil treatment for grub and mole cricket control, applied preventatively or at first signs of root-level damage.",
    image: {
      src: "https://images.pexels.com/photos/25974981/pexels-photo-25974981.jpeg?auto=compress&cs=tinysrgb&w=1600",
      alt: "Gloved hands holding a bag of granular soil treatment",
    },
  },
];
