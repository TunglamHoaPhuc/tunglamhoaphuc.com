import PortfolioDetailsMain from "@/components/layout/main/PortfolioDetailsMain";
import Cta from "@/components/sections/cta/Cta";
import HeaderSpace from "@/components/shared/others/HeaderSpace";
import getPortfolio from "@/libs/getPortfolio";
import { notFound } from "next/navigation";
const items = getPortfolio();

export default async function PortfolioDetails({ params }) {
	const { id } = await params;

	const isExistItem = items?.find(({ id: id1 }) => id1 === parseInt(id));
	if (!isExistItem) {
		notFound();
	}
	return (
		<main>
			<HeaderSpace />
			<PortfolioDetailsMain currentItemId={parseInt(id)} />
			<Cta />
		</main>
	);
}
export async function generateStaticParams() {
	return items?.map(({ id }) => ({ id: id.toString() }));
}
