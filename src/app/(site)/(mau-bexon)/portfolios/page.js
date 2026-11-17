import Cta from "@/components/sections/cta/Cta";
import HeroInner from "@/components/sections/hero/HeroInner";
import PortfoliosPrimary from "@/components/sections/portfolios/PortfoliosPrimary";
import HeaderSpace from "@/components/shared/others/HeaderSpace";
export default function Portfolios() {
	return (
		<main>
			<HeaderSpace />
			<HeroInner title={"Portfolio"} text={"Portfolio"} />
			<PortfoliosPrimary />
			<Cta />
		</main>
	);
}
