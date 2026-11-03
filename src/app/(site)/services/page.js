import Brands1 from "@/components/sections/brands/Brands1";
import Contact2 from "@/components/sections/contacts/Contact2";
import Cta from "@/components/sections/cta/Cta";
import HeroInner from "@/components/sections/hero/HeroInner";
import PricingPlan from "@/components/sections/pricing-plan/PricingPlan";
import ServicesPrimary from "@/components/sections/services/ServicesPrimary";
import HeaderSpace from "@/components/shared/others/HeaderSpace";
export default function Services() {
	return (
		<main>
			<HeaderSpace />
			<HeroInner title={"Services"} text={"Services"} />
			<ServicesPrimary />
			<Contact2 />
			<PricingPlan type={3} />
			<Brands1 type={2} />
			<Cta />
		</main>
	);
}
