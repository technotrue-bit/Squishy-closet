// The test build's bao looks, taken from the colors of Devin's reference
// picture. Each look is a color, a finish and the pitch of its squeak.

export type Finish = "matte" | "shiny" | "glitter";

export interface Look {
  id: string;
  name: string;
  color: string;
  finish: Finish;
  ink: string;
  blush: string;
  pitch: number;
  /** Sparkle color for glitter. */
  sparkle?: string;
}

export const LOOKS: Look[] = [
  { id: "rosy", name: "Rosy Bao", color: "#f2a9cf", finish: "shiny", ink: "#2a1a24", blush: "#ff7fa6", pitch: 1.0 },
  { id: "peach", name: "Peachy Bao", color: "#f8c3c6", finish: "matte", ink: "#2a1a24", blush: "#ff8a9a", pitch: 1.08 },
  { id: "cherry", name: "Cherry Bao", color: "#d9573f", finish: "shiny", ink: "#2a1414", blush: "#ff9a8a", pitch: 0.92 },
  { id: "blueberry", name: "Blueberry Bao", color: "#2f63d8", finish: "shiny", ink: "#141026", blush: "#ff9fc0", pitch: 0.86 },
  { id: "snow", name: "Snow Bao", color: "#f7f4ef", finish: "matte", ink: "#2a1a24", blush: "#ffa0ae", pitch: 1.15 },
  { id: "gold", name: "Gold Bao", color: "#e0ae45", finish: "glitter", ink: "#2a1a10", blush: "#ff9a86", pitch: 1.22, sparkle: "#fff3c4" },
];

export const lookById = (id: string): Look => LOOKS.find((l) => l.id === id) ?? LOOKS[0];
