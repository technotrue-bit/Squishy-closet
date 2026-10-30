// Every squishy in the game, one record each. A squishy is built from its record
// (body shape, skin, extras, face, finish, feel), so adding a set is just adding
// records. "foundBy" already has room for the phone app's ways to find them:
// scanning a real squishy, visiting a place, finishing a mission. Halloween
// Specials are only ever in Spooky Boxes, which come on Halloween.

export type Family = "bao" | "spooky" | "halloween";
export type Finish = "matte" | "shiny" | "glitter" | "glow" | "gold";
export type BodyKind = "bao" | "mochi" | "ghost" | "drop" | "pumpkin";
export type Personality = "Bouncy" | "Sleepy" | "Shy" | "Silly" | "Brave" | "Sweet";

export type Skin =
  | { kind: "plain" }
  /** Candy corn: colors from the bottom up. */
  | { kind: "bands"; colors: [string, string, string] }
  /** Mummy wraps over the body color. */
  | { kind: "wraps"; color: string }
  /** A bottom color with a top that drips down (cauldron pudding). */
  | { kind: "top"; color: string; rim: string }
  /** Little cartoon bones dotted around the sides and back. */
  | { kind: "bones"; color: string };

export type Part = "catEars" | "batWings" | "stem" | "witchHat" | "bolts" | "spiderLegs" | "collar" | "bowTie" | "leaf";
export type FaceExtra = "fangs" | "stitch" | "boo" | "nose" | "whiskers";

export type FoundBy =
  | { kind: "box" }
  /** Only in a Spooky Box. */
  | { kind: "spookyBox" }
  | { kind: "scan"; code: string }
  | { kind: "place"; place: string }
  | { kind: "mission"; mission: string };

export interface SquishyDef {
  /** Number in the Squishy Book, 1.. */
  no: number;
  id: string;
  name: string;
  family: Family;
  /** The design it is a version of, e.g. "Pumpkin Bao". */
  design: string;
  finish: Finish;
  body: BodyKind;
  color: string;
  skin: Skin;
  parts: Part[];
  ink: string;
  blush: string;
  face?: FaceExtra;
  /** Color of glitter flecks or the glow. */
  sparkle?: string;
  glow?: string;
  personality: Personality;
  /** 0 firm and bouncy .. 1 super soft and slow to rise. */
  soft: number;
  pitch: number;
  foundBy: FoundBy[];
}

export const FAMILIES: { id: Family; name: string; place: string }[] = [
  { id: "bao", name: "Bao Buns", place: "Steamer Bay" },
  { id: "spooky", name: "Spooky", place: "Spooky Hollow" },
  { id: "halloween", name: "Halloween Specials", place: "Spooky Hollow" },
];

export const FINISH_NAME: Record<Finish, string> = {
  matte: "Matte",
  shiny: "Shiny",
  glitter: "Glitter",
  glow: "Glow",
  gold: "Gold",
};

const PERSONALITIES: Personality[] = ["Sweet", "Bouncy", "Silly", "Sleepy", "Shy", "Brave"];
const DARK_INK = "#2a1a24";
const LIGHT_INK = "#fff6ea";

interface BaoFlavor {
  key: string;
  name: string;
  color: string;
  ink?: string;
  blush: string;
  sparkle: string;
  soft: number;
  pitch: number;
}

// The bao flavors, starting with the colors from Devin's picture.
const BAO_FLAVORS: BaoFlavor[] = [
  { key: "rosy", name: "Rosy", color: "#f2a9cf", blush: "#ff7fa6", sparkle: "#ffffff", soft: 0.55, pitch: 1.0 },
  { key: "peachy", name: "Peachy", color: "#f8c3c6", blush: "#ff8a9a", sparkle: "#fff0f2", soft: 1, pitch: 1.08 },
  { key: "cherry", name: "Cherry", color: "#d9573f", ink: "#2a1414", blush: "#ff9a8a", sparkle: "#ffd6c9", soft: 0.2, pitch: 0.92 },
  { key: "blueberry", name: "Blueberry", color: "#2f63d8", ink: "#141026", blush: "#ff9fc0", sparkle: "#d6e6ff", soft: 0.4, pitch: 0.86 },
  { key: "snow", name: "Snow", color: "#f7f4ef", blush: "#ffa0ae", sparkle: "#e8f3ff", soft: 0.8, pitch: 1.15 },
  { key: "lilac", name: "Lilac", color: "#c9a8f0", blush: "#ff8fc0", sparkle: "#ffffff", soft: 0.7, pitch: 1.04 },
  { key: "matcha", name: "Matcha", color: "#a9d18e", blush: "#ff9a9a", sparkle: "#f4ffe0", soft: 0.35, pitch: 0.95 },
  { key: "mango", name: "Mango", color: "#ffc94d", blush: "#ff8a6a", sparkle: "#fff6c9", soft: 0.6, pitch: 1.1 },
  { key: "sesame", name: "Sesame", color: "#3a3540", ink: LIGHT_INK, blush: "#ff8fb0", sparkle: "#e6e0ff", soft: 0.25, pitch: 0.82 },
];

const BAO_GOLD: { key: string; name: string; color: string; sparkle: string; soft: number; pitch: number }[] = [
  { key: "gold", name: "Gold Bao", color: "#e0ae45", sparkle: "#fff3c4", soft: 0, pitch: 1.22 },
  { key: "rosegold", name: "Rose Gold Bao", color: "#e8a49a", sparkle: "#ffe6e0", soft: 0.3, pitch: 1.18 },
  { key: "silverstar", name: "Silver Star Bao", color: "#c9d1e3", sparkle: "#ffffff", soft: 0.5, pitch: 1.28 },
];

interface SpookyDesign {
  key: string;
  name: string;
  body: BodyKind;
  color: string;
  skin?: Skin;
  parts?: Part[];
  ink?: string;
  blush?: string;
  face?: FaceExtra;
  sparkle: string;
  glow: string;
  soft: number;
  pitch: number;
}

// Cute, never scary.
const SPOOKY: SpookyDesign[] = [
  { key: "pumpkin", name: "Pumpkin Bao", body: "pumpkin", color: "#ff9a3c", parts: ["stem"], blush: "#ff6a5a", sparkle: "#fff0c0", glow: "#ffb347", soft: 0.45, pitch: 0.95 },
  { key: "boo", name: "Boo Bun", body: "ghost", color: "#fbfbff", face: "boo", blush: "#ffb3c7", sparkle: "#dff2ff", glow: "#bff3ff", soft: 0.9, pitch: 1.2 },
  { key: "batty", name: "Batty Mochi", body: "mochi", color: "#6b5a8e", parts: ["batWings", "catEars"], ink: LIGHT_INK, face: "fangs", blush: "#ff8fc0", sparkle: "#e6d6ff", glow: "#c69bff", soft: 0.6, pitch: 1.12 },
  { key: "candycorn", name: "Candy Corn Drop", body: "drop", color: "#ffd23f", skin: { kind: "bands", colors: ["#ffd23f", "#ff8a1f", "#fff8ec"] }, blush: "#ff7a6a", sparkle: "#fffbe0", glow: "#ffe27a", soft: 0.2, pitch: 1.25 },
  { key: "mummy", name: "Mummy Bun", body: "mochi", color: "#d9cbb0", skin: { kind: "wraps", color: "#fffaf0" }, blush: "#ffa0a8", sparkle: "#fffaf0", glow: "#e8ffd0", soft: 0.5, pitch: 0.9 },
  { key: "witchy", name: "Witchy Bao", body: "bao", color: "#b7e08a", parts: ["witchHat"], blush: "#ff9aa8", sparkle: "#f0ffd8", glow: "#c8ff8a", soft: 0.4, pitch: 1.05 },
  { key: "franky", name: "Franky Dumpling", body: "bao", color: "#8fcf86", parts: ["bolts"], face: "stitch", ink: "#1e2a1e", blush: "#ff9a9a", sparkle: "#eaffea", glow: "#9dff8a", soft: 0.15, pitch: 0.8 },
  { key: "count", name: "Count Bao", body: "bao", color: "#ece6f4", parts: ["collar", "bowTie"], face: "fangs", blush: "#ff8fb0", sparkle: "#f3e8ff", glow: "#d8b8ff", soft: 0.55, pitch: 0.88 },
  { key: "skelly", name: "Skelly Bun", body: "mochi", color: "#b8aed6", skin: { kind: "bones", color: "#ffffff" }, face: "nose", blush: "#ffb0c0", sparkle: "#ffffff", glow: "#eaffff", soft: 0.3, pitch: 1.0 },
  { key: "spider", name: "Spider Puff", body: "mochi", color: "#2e2838", parts: ["spiderLegs"], ink: LIGHT_INK, blush: "#ff7fb0", sparkle: "#d8c8ff", glow: "#b58cff", soft: 0.85, pitch: 1.3 },
  { key: "moonkitty", name: "Moon Kitty", body: "mochi", color: "#3c3456", parts: ["catEars"], ink: "#ffe27a", face: "whiskers", blush: "#ff8fc0", sparkle: "#fff3b0", glow: "#ffe27a", soft: 0.7, pitch: 1.15 },
  { key: "cauldron", name: "Cauldron Pudding", body: "mochi", color: "#2f2b36", skin: { kind: "top", color: "#8fd14f", rim: "#4a4553" }, ink: LIGHT_INK, blush: "#ff8fb0", sparkle: "#e8ffd0", glow: "#a8ff5a", soft: 0.95, pitch: 0.92 },
];

// Halloween Specials: one of a kind, each in its own finish. Only in Spooky Boxes.
const HALLOWEEN: (SpookyDesign & { finish: Finish })[] = [
  { key: "lantern", name: "Lantern Pumpkin", body: "pumpkin", finish: "glow", color: "#ff8a1f", parts: ["stem"], blush: "#ff5a4a", sparkle: "#fff0c0", glow: "#ffb347", soft: 0.5, pitch: 0.98 },
  { key: "ghostkitty", name: "Ghost Kitty", body: "ghost", finish: "glow", color: "#f6f2ff", parts: ["catEars"], face: "whiskers", blush: "#ffb3d1", sparkle: "#e8dcff", glow: "#cdb6ff", soft: 0.85, pitch: 1.24 },
  { key: "batpumpkin", name: "Bat Pumpkin", body: "pumpkin", finish: "glitter", color: "#8a6ad8", parts: ["batWings", "stem"], ink: LIGHT_INK, face: "fangs", blush: "#ff8fc0", sparkle: "#ffd27a", glow: "#c69bff", soft: 0.4, pitch: 1.08 },
  { key: "witchdrop", name: "Witch Candy Drop", body: "drop", finish: "glow", color: "#d4b8ff", skin: { kind: "bands", colors: ["#b8f06a", "#d4b8ff", "#8a5cf0"] }, parts: ["witchHat"], blush: "#ff8fb0", sparkle: "#f0ffd8", glow: "#c8ff8a", soft: 0.3, pitch: 1.18 },
  { key: "goldpumpkin", name: "Golden Pumpkin", body: "pumpkin", finish: "gold", color: "#e0ae45", parts: ["stem"], blush: "#ff8a6a", sparkle: "#fff3c4", glow: "#ffe27a", soft: 0.2, pitch: 1.12 },
  { key: "goldboo", name: "Golden Boo", body: "ghost", finish: "gold", color: "#efc65a", face: "boo", blush: "#ffb3a0", sparkle: "#fffbe0", glow: "#fff3b0", soft: 0.75, pitch: 1.3 },
];

const SPOOKY_FINISHES: Finish[] = ["matte", "glitter", "glow"];
const BAO_FINISHES: Finish[] = ["matte", "shiny", "glitter"];

function buildCatalog(): SquishyDef[] {
  const out: SquishyDef[] = [];
  let no = 1;
  for (const finish of BAO_FINISHES) {
    for (const f of BAO_FLAVORS) {
      const prefix = finish === "matte" ? "" : `${FINISH_NAME[finish]} `;
      out.push({
        no: no++,
        id: `bao-${f.key}-${finish}`,
        name: `${prefix}${f.name} Bao`,
        family: "bao",
        design: `${f.name} Bao`,
        finish,
        body: "bao",
        color: f.color,
        skin: { kind: "plain" },
        parts: [],
        ink: f.ink ?? DARK_INK,
        blush: f.blush,
        sparkle: f.sparkle,
        personality: PERSONALITIES[(no + f.key.length) % PERSONALITIES.length],
        soft: f.soft,
        pitch: f.pitch * (finish === "glitter" ? 1.06 : finish === "shiny" ? 1.03 : 1),
        foundBy: [{ kind: "box" }],
      });
    }
  }
  for (const g of BAO_GOLD) {
    out.push({
      no: no++,
      id: `bao-${g.key}`,
      name: g.name,
      family: "bao",
      design: g.name,
      finish: "gold",
      body: "bao",
      color: g.color,
      skin: { kind: "plain" },
      parts: [],
      ink: DARK_INK,
      blush: "#ff9a86",
      sparkle: g.sparkle,
      personality: "Brave",
      soft: g.soft,
      pitch: g.pitch,
      foundBy: [{ kind: "box" }],
    });
  }
  for (const finish of SPOOKY_FINISHES) {
    for (const d of SPOOKY) {
      const prefix = finish === "matte" ? "" : `${FINISH_NAME[finish]} `;
      out.push({
        no: no++,
        id: `spooky-${d.key}-${finish}`,
        name: `${prefix}${d.name}`,
        family: "spooky",
        design: d.name,
        finish,
        body: d.body,
        color: d.color,
        skin: d.skin ?? { kind: "plain" },
        parts: d.parts ?? [],
        ink: d.ink ?? DARK_INK,
        blush: d.blush ?? "#ff9aa8",
        face: d.face,
        sparkle: d.sparkle,
        glow: d.glow,
        personality: PERSONALITIES[(no * 7 + d.key.length) % PERSONALITIES.length],
        soft: d.soft,
        pitch: d.pitch * (finish === "glitter" ? 1.05 : 1),
        foundBy: [{ kind: "box" }],
      });
    }
  }
  for (const d of HALLOWEEN) {
    out.push({
      no: no++,
      id: `halloween-${d.key}`,
      name: d.name,
      family: "halloween",
      design: d.name,
      finish: d.finish,
      body: d.body,
      color: d.color,
      skin: d.skin ?? { kind: "plain" },
      parts: d.parts ?? [],
      ink: d.ink ?? DARK_INK,
      blush: d.blush ?? "#ff9aa8",
      face: d.face,
      sparkle: d.sparkle,
      glow: d.glow,
      personality: PERSONALITIES[(no * 5 + d.key.length) % PERSONALITIES.length],
      soft: d.soft,
      pitch: d.pitch,
      foundBy: [{ kind: "spookyBox" }],
    });
  }
  return out;
}

export const CATALOG: SquishyDef[] = buildCatalog();

const BY_ID = new Map(CATALOG.map((d) => [d.id, d]));
export const defById = (id: string): SquishyDef | undefined => BY_ID.get(id);
