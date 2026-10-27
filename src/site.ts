// TrueAIGaming and its preview builds: the only pages the game ever posts a save to.

const SITE = [/^https:\/\/(www\.)?trueaigaming\.com$/, /^https:\/\/trueaigaming-[a-z0-9-]+-true-team2\.vercel\.app$/];

export const isSite = (origin: string): boolean => SITE.some((re) => re.test(origin));
