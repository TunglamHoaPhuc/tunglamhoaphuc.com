// "Các Chương Trình Cộng Tu" cards: the regular ceremonies the admin keeps in the study calendar (Lịch tu học > Khóa lễ thường kỳ,
// table `featured_program`: title, the lunar days in the editors' words, time, picture). Nothing on a card is written in the code
// except the mark each card wears (design), which the component picks by position.
import { getContentRepository } from "@/lib/tlhp-content/repository";
import type { ContentRepository, RegularProgram } from "@/lib/tlhp-content/types";
import { toSlug } from "@/lib/schedule-detail";
import { absUrl } from "@/lib/v3-data";

export type HomeProgram = {
	id: string;
	title: string;
	/** The lunar days as the editors wrote them ("Mùng 1 và Rằm âm lịch hằng tháng"); the time of day when they wrote none. */
	schedule: string;
	/** "" when the admin set no picture: the card then draws its frame without one. */
	imgUrl: string;
	imgPosition: string;
	/** The ceremony's page in the study calendar. */
	href: string;
};

/** The cards from the ceremonies (editors' order); one with no title is not a card. Pure. */
export function programsFromSchedule(programs: RegularProgram[]): HomeProgram[] {
	return programs.flatMap((program) => {
		const title = program.title.trim();
		if (!title) return [];
		const schedule = program.summary.trim() || program.time.trim();
		return [
			{
				id: program.id,
				title,
				schedule,
				imgUrl: absUrl(program.image?.src),
				imgPosition: program.image?.position || "center 50%",
				href: `/lich-tu-hoc/${toSlug(title)}`,
			},
		];
	});
}

/** Reads the ceremonies and builds the cards. Throws when D1 cannot be read: the caller decides what to show instead. */
export async function loadHomePrograms(repo?: ContentRepository): Promise<HomeProgram[]> {
	const r = repo ?? (await getContentRepository());
	return programsFromSchedule((await r.getSchedule()).programs);
}
