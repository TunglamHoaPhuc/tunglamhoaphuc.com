import ServiceDetailsMain from "@/components/layout/main/ServiceDetailsMain";
import Cta from "@/components/sections/cta/Cta";
import HeaderSpace from "@/components/shared/others/HeaderSpace";
import getALlServices from "@/libs/getALlServices";
import { notFound } from "next/navigation";
const items = getALlServices();

export default async function ServiceDetails({ params }) {
	const { id } = await params;

	const isExistItem = items?.find(({ id: id1 }) => id1 === parseInt(id));
	if (!isExistItem) {
		notFound();
	}
	return (
		<main>
			<HeaderSpace />
			<ServiceDetailsMain currentItemId={parseInt(id)} />
			<Cta />
		</main>
	);
}
export async function generateStaticParams() {
	return items?.map(({ id }) => ({ id: id.toString() }));
}
