// Who a squishy is inside. Every squishy has a personality: it changes how it
// fidgets, naps, sounds and plays with friends, and what it says when it comes
// up to see you. Squishies from boxes get one at random; a baby grows into one
// from how you play with it and what you teach it.

import type { Expression } from "./face";

export const MOOD_IDS = [
  "bouncy",
  "sweet",
  "sleepy",
  "shy",
  "silly",
  "brave",
  "cuddly",
  "curious",
  "sassy",
  "calm",
  "musical",
  "sporty",
  "dreamy",
  "grumpy",
] as const;
export type MoodId = (typeof MOOD_IDS)[number];

/** A little thing it does now and then that shows who it is. */
export type Quirk = "bounce" | "spin" | "sing" | "look" | "stretch" | "wiggle" | "blush" | "pout" | "puff" | "dream";

export interface Mood {
  id: MoodId;
  name: string;
  icon: string;
  /** What it's like, in a few words. */
  about: string;
  /** Voice pitch and hop height, times its usual. */
  voice: number;
  hop: number;
  /** Seconds left alone before it yawns. */
  sleepAfter: number;
  /** Seconds between fidgets, about. */
  fidget: number;
  /** The face it pulls when it's being itself. */
  face: Expression;
  quirk: Quirk;
  /** How much, out playing, it likes jobs, chatting and coming up to you. */
  work: number;
  chat: number;
  visit: number;
  /** What it says when it comes up front. {n} is its name. */
  says: string[];
  /** The lesson that grows a baby into this one. */
  lesson: { icon: string; name: string } | null;
}

export const MOODS: Mood[] = [
  {
    id: "bouncy", name: "Bouncy", icon: "🦘", about: "Can't stop bouncing!",
    voice: 1.08, hop: 1.25, sleepAfter: 40, fidget: 3.5, face: "happy", quirk: "bounce",
    work: 1, chat: 1, visit: 1.2, says: ["{n} wants to bounce!", "Boing boing! It's {n}!"],
    lesson: { icon: "🦘", name: "Bounce" },
  },
  {
    id: "sweet", name: "Sweet", icon: "🍰", about: "Kind to everyone",
    voice: 1.05, hop: 1, sleepAfter: 28, fidget: 5, face: "love", quirk: "blush",
    work: 1, chat: 1.3, visit: 1.2, says: ["{n} brought you a hug!", "{n} thinks you're the best!"],
    lesson: { icon: "🍰", name: "Share treats" },
  },
  {
    id: "sleepy", name: "Sleepy", icon: "😴", about: "Naps anywhere",
    voice: 0.92, hop: 0.8, sleepAfter: 12, fidget: 7, face: "sleepy", quirk: "stretch",
    work: 0.7, chat: 0.6, visit: 0.9, says: ["{n} wants a cuddle...", "{n} is a bit sleepy"],
    lesson: { icon: "🌙", name: "Nap time" },
  },
  {
    id: "shy", name: "Shy", icon: "🙈", about: "Quiet, but loves you lots",
    voice: 1.12, hop: 0.85, sleepAfter: 30, fidget: 6, face: "shy", quirk: "blush",
    work: 1, chat: 0.5, visit: 0.7, says: ["{n} came to say hi...", "{n} peeks at you"],
    lesson: null,
  },
  {
    id: "silly", name: "Silly", icon: "🤪", about: "Always goofing around",
    voice: 1.1, hop: 1.1, sleepAfter: 35, fidget: 4, face: "giggle", quirk: "spin",
    work: 0.9, chat: 1.3, visit: 1.1, says: ["{n} has a joke!", "{n} is being silly!"],
    lesson: { icon: "🤡", name: "Tell jokes" },
  },
  {
    id: "brave", name: "Brave", icon: "🦸", about: "Not scared of anything",
    voice: 0.95, hop: 1.2, sleepAfter: 32, fidget: 5, face: "happy", quirk: "puff",
    work: 1.3, chat: 0.9, visit: 1, says: ["{n} is here to help!", "{n} feels super brave!"],
    lesson: { icon: "🦸", name: "Be brave" },
  },
  {
    id: "cuddly", name: "Cuddly", icon: "🤗", about: "Loves hugs most of all",
    voice: 1, hop: 0.9, sleepAfter: 26, fidget: 5, face: "love", quirk: "wiggle",
    work: 0.8, chat: 1, visit: 1.6, says: ["{n} wants a hug!", "{n} wants to snuggle!"],
    lesson: { icon: "🤗", name: "Hugs" },
  },
  {
    id: "curious", name: "Curious", icon: "🔍", about: "Wants to know everything",
    voice: 1.06, hop: 1, sleepAfter: 34, fidget: 4, face: "surprised", quirk: "look",
    work: 1.4, chat: 1, visit: 1, says: ["{n} found something!", "{n} has a question!"],
    lesson: { icon: "📚", name: "Read books" },
  },
  {
    id: "sassy", name: "Sassy", icon: "💅", about: "Fancy and proud",
    voice: 1.04, hop: 1, sleepAfter: 32, fidget: 5, face: "happy", quirk: "spin",
    work: 0.8, chat: 1.3, visit: 1.1, says: ["{n} wants to show off!", "{n} looks fabulous!"],
    lesson: { icon: "👗", name: "Dress up" },
  },
  {
    id: "calm", name: "Calm", icon: "🍃", about: "Takes it slow and easy",
    voice: 0.94, hop: 0.8, sleepAfter: 30, fidget: 8, face: "closed", quirk: "stretch",
    work: 1, chat: 0.8, visit: 0.9, says: ["{n} came to sit with you", "{n} says take a deep breath"],
    lesson: { icon: "🧘", name: "Quiet time" },
  },
  {
    id: "musical", name: "Musical", icon: "🎵", about: "Hums all day long",
    voice: 1.03, hop: 1, sleepAfter: 32, fidget: 4.5, face: "happy", quirk: "sing",
    work: 1, chat: 1.2, visit: 1.1, says: ["{n} wants to sing!", "{n} made up a song!"],
    lesson: { icon: "🎵", name: "Sing songs" },
  },
  {
    id: "sporty", name: "Sporty", icon: "⚽", about: "Always on the move",
    voice: 1, hop: 1.3, sleepAfter: 40, fidget: 3, face: "happy", quirk: "bounce",
    work: 1.4, chat: 0.8, visit: 1, says: ["{n} wants to race!", "{n} is ready to play!"],
    lesson: { icon: "⚽", name: "Play ball" },
  },
  {
    id: "dreamy", name: "Dreamy", icon: "🌈", about: "Head in the clouds",
    voice: 1.02, hop: 0.9, sleepAfter: 22, fidget: 6, face: "love", quirk: "dream",
    work: 0.8, chat: 0.9, visit: 1, says: ["{n} had a dream about you!", "{n} saw a rainbow!"],
    lesson: { icon: "🌈", name: "Daydream" },
  },
  {
    id: "grumpy", name: "Grumpy", icon: "😤", about: "Grumbly, but secretly sweet",
    voice: 0.88, hop: 0.9, sleepAfter: 28, fidget: 6, face: "pout", quirk: "pout",
    work: 1.1, chat: 0.6, visit: 0.8, says: ["{n} wants a hug. Maybe.", "Hmph! {n} missed you."],
    lesson: null,
  },
];

export const moodById = (id: string | undefined | null): Mood => MOODS.find((m) => m.id === id) ?? MOODS[0];
export const isMood = (id: unknown): id is MoodId => typeof id === "string" && (MOOD_IDS as readonly string[]).includes(id);

/** The personality printed on each squishy's design, as a starting point. */
const FROM_CATALOG: Record<string, MoodId> = {
  Bouncy: "bouncy",
  Sleepy: "sleepy",
  Shy: "shy",
  Silly: "silly",
  Brave: "brave",
  Sweet: "sweet",
};
export const catalogMood = (name: string): MoodId => FROM_CATALOG[name] ?? "bouncy";

export const randomMood = (rand: () => number): MoodId => MOOD_IDS[Math.floor(rand() * MOOD_IDS.length) % MOOD_IDS.length];

/** Lessons a baby can learn: one for each personality that has one. */
export const LESSONS = MOODS.filter((m) => m.lesson).map((m) => ({ mood: m.id, ...m.lesson! }));

/** A line it says when it comes up front. */
export function sayLine(mood: Mood, name: string, rand: () => number = Math.random): string {
  const line = mood.says[Math.floor(rand() * mood.says.length) % mood.says.length];
  return line.replace("{n}", name);
}
