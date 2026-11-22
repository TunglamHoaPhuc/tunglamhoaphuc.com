import type { AboutTopic } from "@/libs/content/types";
import { otherTopicsOf, type NguoiLienQuanLayout } from "./content";
import { GioiThieuDetailLayout } from "./GioiThieuDetailLayout";
import { TieuSuSuToOdysseyView } from "./TieuSuSuToOdysseyView";
import "./nguoi-lien-quan.css";

/**
 * A topic of "Người Liên Quan" as the old site showed it: the Odyssey view for Sư Tổ, the detail
 * layout for every other topic (content.ts decides). The old pages' Tailwind classes come
 * compiled in nguoi-lien-quan.css (scripts/nguoi-lien-quan-css.mjs), scoped to
 * #tlhp-nguoi-lien-quan. The page scrolls natively (data-tlhp-native-scroll), as there: the
 * Odyssey's rails and buttons are fixed to the window. The old pages' AI search bar is not
 * drawn: this site has no assistant yet.
 */
export default function NguoiLienQuanPage({ layout, topics }: { layout: NguoiLienQuanLayout; topics: AboutTopic[] }) {
	const others = otherTopicsOf(topics);
	return (
		<main>
			<div id="tlhp-nguoi-lien-quan" data-tlhp-native-scroll="">
				{layout.kind === "odyssey" ? <TieuSuSuToOdysseyView detail={layout.detail} otherTopics={others} /> : <GioiThieuDetailLayout detail={layout.detail} otherTopics={others} />}
			</div>
		</main>
	);
}
