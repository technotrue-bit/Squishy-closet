// TrueAIGaming and its preview builds: the only pages the game ever posts a save to.

const SITE = [/^https:\/\/(www\.)?trueaigaming\.com$/, /^https:\/\/trueaigaming-[a-z0-9-]+-true-team2\.vercel\.app$/];

export const isSite = (origin: string): boolean => SITE.some((re) => re.test(origin));

/** The game's play page on TrueAIGaming. Links made in the app point here, since the app's own address opens nowhere else. */
export const PLAY_PAGE = "https://trueaigaming.com/play.html?id=squishy-closet";
