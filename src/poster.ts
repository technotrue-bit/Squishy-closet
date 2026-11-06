// The poster: a clean picture of Aurora's World for TrueAIGaming's game card. Open the game with ?poster and it
// goes straight to the beach with four squishies out playing in hats that suit the day (a witch hat in October, a
// pom beanie in the fall), the place dressed for the season, the logo on top and no buttons. A screenshot of it is
// the card, so the card follows the seasons too. It plays with a made-up collection and never saves, so it can
// never touch anyone's real squishies. The page names its look on <html data-dress="..."> (halloween, autumn or
// plain), so the site's card job can tell when the look has changed and only retake the card then.

import { freshSave, type Save } from "./save";
import type { Dress } from "./season";
import type { MoodId } from "./personality";

/** Is this address asking for the poster? */
export const isPoster = (search: string): boolean => /[?&]poster(?:=[^&]*)?(?:&|$)/.test(search);

/** Who is out on the poster and what they wear: the first is the one you hold, in the middle. */
const CAST: Record<"halloween" | "autumn" | "plain", [string, string, MoodId][]> = {
  halloween: [
    ["bao-rosy-matte", "witch", "bouncy"],
    ["spooky-pumpkin-matte", "pumpkin", "silly"],
    ["spooky-boo-matte", "batBow", "shy"],
    ["spooky-batty-matte", "candyCorn", "bouncy"],
  ],
  autumn: [
    ["bao-rosy-matte", "beanie", "bouncy"],
    ["spooky-pumpkin-matte", "beret", "silly"],
    ["bao-mango-matte", "bow", "sweet"],
    ["bao-lilac-matte", "nightcap", "sleepy"],
  ],
  plain: [
    ["bao-rosy-matte", "sunHat", "bouncy"],
    ["bao-lilac-matte", "captain", "silly"],
    ["bao-mango-matte", "flowerCrown", "sweet"],
    ["bao-blueberry-matte", "bow", "shy"],
  ],
};

/** The poster's made-up collection, for the day's dress. `now` keeps everyone freshly bathed. */
export function posterSave(dress: Dress, now: number): Save {
  const s = freshSave();
  const cast = CAST[dress ?? "plain"];
  cast.forEach(([id, hat, mood], i) => (s.owned[id] = { got: 1 + i, hat, mood, washed: now }));
  s.active = cast[0][0];
  s.team = cast.slice(1).map(([id]) => id);
  s.hats = ["party", ...cast.map(([, hat]) => hat)];
  s.tutorial = "done";
  s.seen = ["baby", "care"];
  s.place = "beach";
  s.sound = false;
  // Closer in, with no room kept at the bottom for the shelf, which the poster hides.
  s.zoom = 1.5;
  s.trayDown = true;
  // No Halloween box popping up in the middle of the picture.
  s.spookyYear = new Date(now).getFullYear();
  return s;
}
