// What you actually do when a baby wants something. Each wish is a little game
// you play with the baby right there: tap the notes to sing, drag treats to
// share, hold it for a hug. Only the words and rules live here; ui.ts draws it.

import type { MoodId } from "./personality";

/**
 * pop: tap the things floating about. feed: drag each thing to the baby.
 * hold: press and hold the baby. bounce: tap the baby itself.
 */
export type WishPlay = "pop" | "feed" | "hold" | "bounce";

export interface Wish {
  /** What it says when it starts wanting this. {n} is the baby's name. */
  ask: string;
  /** Big words at the top. {n} is the baby's name. */
  title: string;
  /** What to do, in a few words. */
  how: string;
  play: WishPlay;
  /** What floats about (pop), gets dragged over (feed) or drifts up while holding (hold). */
  things: string[];
  /** Taps, drops or bounces needed; for hold, seconds held. */
  need: number;
  /** Said when it's done. */
  yay: string;
}

export const WISHES: Record<string, Wish> = {
  bouncy: { ask: "{n} wants to bounce!", title: "Bounce with {n}!", how: "Tap {n} to make it bounce!", play: "bounce", things: ["✨"], need: 6, yay: "Boing boing!" },
  sweet: { ask: "{n} wants to share a treat!", title: "Share treats with {n}!", how: "Drag each treat to {n}", play: "feed", things: ["🍰", "🍪", "🍓"], need: 3, yay: "Yum! Sharing is sweet!" },
  sleepy: { ask: "{n} is sleepy and wants rocking!", title: "Rock {n} to sleep", how: "Press and hold {n} to rock it", play: "hold", things: ["🌙", "⭐", "💤"], need: 3, yay: "Sweet dreams..." },
  silly: { ask: "{n} wants to hear a joke!", title: "Tell {n} jokes!", how: "Tap the giggles!", play: "pop", things: ["😂", "🤪", "🎈"], need: 5, yay: "Hee hee hee!" },
  brave: { ask: "{n} wants to be brave!", title: "Be brave with {n}!", how: "Tap the silly ghosts to shoo them!", play: "pop", things: ["👻"], need: 5, yay: "So brave!" },
  cuddly: { ask: "{n} wants a hug!", title: "Give {n} a hug!", how: "Press and hold {n} for a big hug", play: "hold", things: ["💗", "💕", "💖"], need: 3, yay: "Best hug ever!" },
  curious: { ask: "{n} wants a story!", title: "Read with {n}!", how: "Drag each book to {n}", play: "feed", things: ["📕", "📗", "📘"], need: 3, yay: "What a story!" },
  sassy: { ask: "{n} wants to dress up!", title: "Dress up {n}!", how: "Drag the fancy things to {n}", play: "feed", things: ["🎀", "👑", "🕶️"], need: 3, yay: "Looking fabulous!" },
  calm: { ask: "{n} wants some quiet time", title: "Quiet time with {n}", how: "Hold {n} and breathe slowly", play: "hold", things: ["🫧", "🍃", "🫧"], need: 4, yay: "Ahhh, so calm." },
  musical: { ask: "{n} wants to sing!", title: "Sing with {n}!", how: "Tap the notes!", play: "pop", things: ["🎵", "🎶"], need: 5, yay: "La la la!" },
  sporty: { ask: "{n} wants to play ball!", title: "Play ball with {n}!", how: "Tap the ball!", play: "pop", things: ["⚽"], need: 5, yay: "Goal!" },
  dreamy: { ask: "{n} wants to daydream", title: "Daydream with {n}", how: "Tap the shooting stars!", play: "pop", things: ["⭐", "🌈", "☁️"], need: 5, yay: "What a lovely dream!" },
};

export const wishFor = (m: MoodId): Wish => WISHES[m] ?? WISHES.bouncy;

export const wishWords = (s: string, name: string): string => s.replace(/\{n\}/g, name);
