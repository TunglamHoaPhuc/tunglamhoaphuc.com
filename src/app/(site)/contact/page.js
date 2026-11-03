import Contact3 from "@/components/sections/contacts/Contact3";
import ContactTop from "@/components/sections/contacts/ContactTop";
import Cta from "@/components/sections/cta/Cta";
import HeroInner from "@/components/sections/hero/HeroInner";
import HeaderSpace from "@/components/shared/others/HeaderSpace";
export default function Contact() {
	return (
		<main>
			<HeaderSpace />
			<HeroInner title={"Contact Us"} text={"Contact Us"} />
			<ContactTop />
			<Contact3 />
			<Cta />
		</main>
	);
}
