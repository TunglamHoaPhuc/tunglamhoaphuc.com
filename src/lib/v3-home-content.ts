// What the home page's first screen (the hero) says and plays, from the admin's home settings (the `setting` table, edited at
// www's /quan-tri/trang-chu). Pure: nothing here reads D1 (app/page.tsx reads the settings, the schedule and the newest posts and
// hands them over), and nothing here is a server-only module, because the hero is a client component.
//
// The hero is one video with frames over it: each frame has a title, a line under it, a short paragraph and a button, and the hero
// turns through them (features/home/components/Hero.tsx). The frames are the admin's `home.hero` frames that are valid and switched
// on, then the next event and the newest post as www adds them (lib/v3-home-hero.ts). The video is the one of `home.welcome` (www's
// "intro video", the site's background video). The frames' pictures are not used: the hero is the video. A setting that is absent
// or invalid leaves the words and the video V3 has always shown, so the page never breaks. Everything is validated by www's own
// readers (lib/tlhp-site/homeSettings.ts, a byte copy of www's src/libs/homeSettings.ts).
import { readWelcome, youtubeId } from "@/lib/tlhp-site/homeSettings";
import { DEFAULT_FRAME, type HeroFrame, type HeroSources, heroFrames, NO_HERO_SOURCES } from "@/lib/v3-home-hero";

/** The video V3's hero has always played: "CHỐN THIÊNG BÌNH YÊN – TÙNG LÂM HÒA PHÚC" on the temple's channel (www's site.introVideo). */
export const DEFAULT_HERO_VIDEO_ID = "HE2MnR8Hl5c";

export type HomeHero = {
	/** The first frame's title and subtitle (what the hero opens on, and what the page's first paint says). */
	title: string;
	/** "" when the admin left the subtitle blank: the hero then draws no line under the title. */
	subtitle: string;
	/** Every frame the hero turns through, the first one as above. Never empty. */
	frames: HeroFrame[];
	videoId: string;
	/** True only for the default video: it has a stretch with people in it (1:36 to 2:44) that the player skips; another video is played whole. */
	cutIntro: boolean;
};

export const DEFAULT_HERO: HomeHero = { title: DEFAULT_FRAME.title, subtitle: DEFAULT_FRAME.subtitle, frames: [DEFAULT_FRAME], videoId: DEFAULT_HERO_VIDEO_ID, cutIntro: true };

/**
 * The hero for the settings read (`{}` when there are none or D1 could not be read) and what the automatic frames are made from
 * (`NO_HERO_SOURCES` leaves them out). Each part falls back on its own. `now` is when the days left are counted.
 */
export function heroFromSettings(settings: Record<string, unknown>, sources: HeroSources = NO_HERO_SOURCES, now = new Date()): HomeHero {
	const frames = heroFrames(settings["home.hero"], sources, now);
	const welcome = readWelcome(settings["home.welcome"]);
	const videoId = (welcome?.videoUrl ? youtubeId(welcome.videoUrl) : null) ?? DEFAULT_HERO_VIDEO_ID;
	return {
		title: frames[0].title,
		subtitle: frames[0].subtitle,
		frames,
		videoId,
		cutIntro: videoId === DEFAULT_HERO_VIDEO_ID,
	};
}
