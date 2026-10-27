// Starts the game. On TrueAIGaming's play page the page's copy of the save is put back first (see mirror.ts), so
// the save is already there when the game reads it.

import { startMirror } from "./mirror";

startMirror()
  .catch(() => {
    // Without the page's copy the game still starts, with what this browser kept.
  })
  .then(() => import("./main"));
