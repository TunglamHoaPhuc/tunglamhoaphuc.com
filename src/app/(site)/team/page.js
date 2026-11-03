import Cta from "@/components/sections/cta/Cta";
import HeroInner from "@/components/sections/hero/HeroInner";
import Team1 from "@/components/sections/teams/Team1";
import HeaderSpace from "@/components/shared/others/HeaderSpace";
export default function Team() {
	return (
		<main>
			<HeaderSpace />
			<HeroInner title={"Team"} text={"Team"} />
			<Team1 type={2} />
			<Cta />
		</main>
	);
}
