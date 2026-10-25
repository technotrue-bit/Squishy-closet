// Every hat in the game. The first one is a gift; each place gives three for
// jobs done there, and some turn up in Squishy Boxes. The 3D hats are built in
// hatModels.ts; this file is only the facts.

export type HatFrom = "gift" | "place" | "box";

export interface HatDef {
  id: string;
  name: string;
  from: HatFrom;
  /** Box hats that turn up mostly in October. */
  spooky?: boolean;
}

export const HATS: HatDef[] = [
  { id: "party", name: "Party Hat", from: "gift" },
  { id: "bow", name: "Big Bow", from: "place" },
  { id: "strawberry", name: "Berry Cap", from: "place" },
  { id: "chef", name: "Chef Hat", from: "place" },
  { id: "sunHat", name: "Sun Hat", from: "place" },
  { id: "flowerCrown", name: "Flower Crown", from: "place" },
  { id: "propeller", name: "Propeller Cap", from: "place" },
  { id: "captain", name: "Captain Hat", from: "place" },
  { id: "sailor", name: "Sailor Cap", from: "place" },
  { id: "pirate", name: "Pirate Hat", from: "place" },
  { id: "nightcap", name: "Sleepy Cap", from: "place" },
  { id: "bunny", name: "Bunny Ears", from: "place" },
  { id: "beanie", name: "Pom Beanie", from: "place" },
  { id: "beret", name: "Artist Beret", from: "place" },
  { id: "ballCap", name: "Star Cap", from: "place" },
  { id: "headphones", name: "Headphones", from: "place" },
  { id: "crown", name: "Crown", from: "box" },
  { id: "topHat", name: "Top Hat", from: "box" },
  { id: "frog", name: "Froggy Hood", from: "box" },
  { id: "witch", name: "Witch Hat", from: "box", spooky: true },
  { id: "pumpkin", name: "Pumpkin Cap", from: "box", spooky: true },
];

const BY_ID = new Map(HATS.map((h) => [h.id, h]));
export const hatById = (id: string): HatDef | undefined => BY_ID.get(id);

/** Chance a box (after the first) has a hat in it too. */
export const BOX_HAT_CHANCE = 0.35;

/** A hat that might come in a box, or null. Spooky ones mostly in October. */
export function boxHat(have: readonly string[], october: boolean, rand: () => number): string | null {
  if (rand() >= BOX_HAT_CHANCE) return null;
  const pool = HATS.filter((h) => h.from === "box" && !have.includes(h.id));
  if (!pool.length) return null;
  const weights = pool.map((h) => (h.spooky ? (october ? 3 : 0.4) : 1));
  let r = rand() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r < 0) return pool[i].id;
  }
  return pool[pool.length - 1].id;
}
