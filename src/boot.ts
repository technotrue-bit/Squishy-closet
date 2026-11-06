// Starts the game. On TrueAIGaming's play page the page's copy of the save is put back first (see mirror.ts), so
// the save is already there when the game reads it. In the iPhone app the app's own copy is put back instead (see
// native.ts).

import { startMirror } from "./mirror";
import { inApp, startNative } from "./native";

(inApp() ? startNative() : startMirror())
  .catch(() => {
    // Without the page's copy the game still starts, with what this browser kept.
  })
  .then(() => import("./main"));
