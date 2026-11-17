import Cta from "@/components/sections/cta/Cta";
import HeroInner from "@/components/sections/hero/HeroInner";
import OurGalleryPrimary from "@/components/sections/our-gallery/OurGalleryPrimary";
import HeaderSpace from "@/components/shared/others/HeaderSpace";
export default function OurGallery() {
	return (
		<main>
			<HeaderSpace />
			<HeroInner title={"Our Gallery"} text={"Our Gallery"} />
			<OurGalleryPrimary />
			<Cta />
		</main>
	);
}
