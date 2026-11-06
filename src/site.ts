// TrueAIGaming and its preview builds: the only pages the game ever posts a save to.

const SITE = [/^https:\/\/(www\.)?trueaigaming\.com$/, /^https:\/\/trueaigaming-[a-z0-9-]+-true-team2\.vercel\.app$/];

export const isSite = (origin: string): boolean => SITE.some((re) => re.test(origin));

/** The game's play page on TrueAIGaming. Links made in the app point here, since the app's own address opens nowhere else. */
export const PLAY_PAGE = "https://trueaigaming.com/play.html?id=squishy-closet";

/** TrueAIGaming's home page, where Leave game goes. */
export const SITE_HOME = "https://trueaigaming.com/";

/**
 * Where Leave game goes: the home page of whichever TrueAIGaming page the game is played in (so a preview build
 * stays on its preview), found from who framed the game or, failing that, the page it came from. Anywhere else,
 * TrueAIGaming itself.
 */
export function siteHome(framer: string | undefined, referrer: string): string {
  for (const from of [framer, referrer]) {
    if (!from) continue;
    try {
      const origin = new URL(from).origin;
      if (isSite(origin)) return `${origin}/`;
    } catch {
      // Not an address: try the next one.
    }
  }
  return SITE_HOME;
}
