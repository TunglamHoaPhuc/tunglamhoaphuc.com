import About12 from "@/components/sections/about/About12";
import Cta from "@/components/sections/cta/Cta";
import HeroInner from "@/components/sections/hero/HeroInner";
import History1 from "@/components/sections/history/History1";
import HeaderSpace from "@/components/shared/others/HeaderSpace";

export default function Histor() {
	return (
		<main>
			<HeaderSpace />
			<HeroInner title={"Company History"} text={"Company History"} />
			<About12 />
			<History1 />
			<Cta />
		</main>
	);
}
