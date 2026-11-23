// What the home page's first screen (the hero) says and plays, from the admin's home settings (the `setting` table, edited at
// www's /quan-tri/trang-chu). Pure: nothing here reads D1 (app/page.tsx reads the settings with getSettings and hands them over),
// and nothing here is a server-only module, because the hero is a client component.
//
// V3's hero is one video with a title and a line under it; it has no slides, pictures, text paragraph or button of the admin's
// kind. So of `home.hero` only the first slide that is valid and switched on is used, for its title and subtitle, and the video is
// the one of `home.welcome` (www's "intro video", the site's background video). A setting that is absent or invalid leaves the
// words and the video V3 has always shown, so the page never breaks. Everything is validated by www's own readers
// (lib/tlhp-site/homeSettings.ts, a byte copy of www's src/libs/homeSettings.ts).
import { readHero, readWelcome, youtubeId } from "@/lib/tlhp-site/homeSettings";

/** The video V3's hero has always played: "CHỐN THIÊNG BÌNH YÊN – TÙNG LÂM HÒA PHÚC" on the temple's channel (www's site.introVideo). */
export const DEFAULT_HERO_VIDEO_ID = "HE2MnR8Hl5c";

export type HomeHero = {
	title: string;
	/** "" when the admin left the subtitle blank: the hero then draws no line under the title. */
	subtitle: string;
	videoId: string;
	/** True only for the default video: it has a stretch with people in it (1:36 to 2:44) that the player skips; another video is played whole. */
	cutIntro: boolean;
};

export const DEFAULT_HERO: HomeHero = { title: "NƠI ĐỂ TRỞ VỀ", subtitle: "CHỐN THIÊNG BÌNH YÊN", videoId: DEFAULT_HERO_VIDEO_ID, cutIntro: true };

const upper = (text: string) => text.toLocaleUpperCase("vi");

/** The hero for the settings read (`{}` when there are none or D1 could not be read). Each part falls back on its own. */
export function heroFromSettings(settings: Record<string, unknown>): HomeHero {
	const slide = readHero(settings["home.hero"])?.slides[0];
	const welcome = readWelcome(settings["home.welcome"]);
	const videoId = (welcome?.videoUrl ? youtubeId(welcome.videoUrl) : null) ?? DEFAULT_HERO_VIDEO_ID;
	return {
		title: slide ? upper(slide.title) : DEFAULT_HERO.title,
		subtitle: slide ? upper(slide.subtitle) : DEFAULT_HERO.subtitle,
		videoId,
		cutIntro: videoId === DEFAULT_HERO_VIDEO_ID,
	};
}
