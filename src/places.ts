// The places you can play: the cozy tea table, a sunny beach, a sailing boat,
// a living room and a busy little city. Friends find jobs to do in each one. This file is only
// the facts (names, jobs, which hats each place gives); the 3D scenes are in
// placeScenes.ts.

export const PLACE_IDS = ["table", "beach", "boat", "room", "city"] as const;
export type PlaceId = (typeof PLACE_IDS)[number];

/** What a friend's body does while it works on a job. */
export type WorkMove = "bob" | "wiggle" | "lean" | "nap" | "spin";

export interface JobDef {
  id: string;
  /** Told when it is done: "Pip built a sandcastle!" */
  done: string;
  /** A picture for the bubble over the worker. */
  icon: string;
  move: WorkMove;
  /** Seconds of work, before helping taps. */
  time: number;
}

export interface PlaceDef {
  id: PlaceId;
  name: string;
  jobs: JobDef[];
  /** Hats found here, in order, and how many jobs done here earns each. */
  hats: { hat: string; jobs: number }[];
}

export const PLACES: PlaceDef[] = [
  {
    id: "table",
    name: "Tea Table",
    jobs: [
      { id: "tea", done: "poured the tea", icon: "🍵", move: "lean", time: 16 },
      { id: "cookies", done: "baked cookies", icon: "🍪", move: "bob", time: 20 },
      { id: "bubbles", done: "blew bubbles", icon: "🫧", move: "spin", time: 14 },
    ],
    hats: [
      { hat: "bow", jobs: 2 },
      { hat: "strawberry", jobs: 5 },
      { hat: "chef", jobs: 9 },
    ],
  },
  {
    id: "beach",
    name: "Sunny Beach",
    jobs: [
      { id: "castle", done: "built a sandcastle", icon: "🏰", move: "bob", time: 22 },
      { id: "shells", done: "found a shell", icon: "🐚", move: "wiggle", time: 15 },
      { id: "splash", done: "splashed in the waves", icon: "🌊", move: "spin", time: 14 },
      { id: "sunnap", done: "napped in the sun", icon: "😴", move: "nap", time: 18 },
    ],
    hats: [
      { hat: "sunHat", jobs: 2 },
      { hat: "flowerCrown", jobs: 5 },
      { hat: "propeller", jobs: 9 },
    ],
  },
  {
    id: "boat",
    name: "Sailing Boat",
    jobs: [
      { id: "steer", done: "steered the boat", icon: "⛵", move: "wiggle", time: 18 },
      { id: "fish", done: "caught a fish", icon: "🐟", move: "lean", time: 20 },
      { id: "lookout", done: "spotted a whale", icon: "🔭", move: "bob", time: 15 },
      { id: "mop", done: "mopped the deck", icon: "🧽", move: "spin", time: 16 },
    ],
    hats: [
      { hat: "captain", jobs: 2 },
      { hat: "sailor", jobs: 5 },
      { hat: "pirate", jobs: 9 },
    ],
  },
  {
    id: "room",
    name: "Living Room",
    jobs: [
      { id: "blocks", done: "stacked the blocks", icon: "🧱", move: "bob", time: 20 },
      { id: "read", done: "read a story", icon: "📖", move: "lean", time: 18 },
      { id: "plant", done: "watered the plant", icon: "🪴", move: "wiggle", time: 15 },
      { id: "tv", done: "watched cartoons", icon: "📺", move: "nap", time: 16 },
    ],
    hats: [
      { hat: "nightcap", jobs: 2 },
      { hat: "bunny", jobs: 5 },
      { hat: "beanie", jobs: 9 },
    ],
  },
  {
    id: "city",
    name: "Little City",
    jobs: [
      { id: "icecream", done: "sold ice cream", icon: "🍦", move: "bob", time: 18 },
      { id: "bus", done: "caught the bus", icon: "🚌", move: "nap", time: 16 },
      { id: "flowers", done: "planted flowers", icon: "🌷", move: "wiggle", time: 15 },
      { id: "paint", done: "painted a mural", icon: "🎨", move: "lean", time: 20 },
    ],
    hats: [
      { hat: "beret", jobs: 2 },
      { hat: "ballCap", jobs: 5 },
      { hat: "headphones", jobs: 9 },
    ],
  },
];

export const placeById = (id: string): PlaceDef => PLACES.find((p) => p.id === id) ?? PLACES[0];

/** Hats a place gives once enough jobs are done there that aren't found yet. */
export function hatsEarned(place: PlaceDef, jobsDone: number, have: readonly string[]): string[] {
  return place.hats.filter((h) => jobsDone >= h.jobs && !have.includes(h.hat)).map((h) => h.hat);
}
