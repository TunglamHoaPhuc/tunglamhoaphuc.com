import Cta from "@/components/sections/cta/Cta";
import HeroInner from "@/components/sections/hero/HeroInner";
import TeamDetails1 from "@/components/sections/teams/TeamDetails1";
import HeaderSpace from "@/components/shared/others/HeaderSpace";
import getTeamMembers from "@/libs/getTeamMembers";
import { notFound } from "next/navigation";
const items = getTeamMembers();

export default async function TeamDetails({ params }) {
	const { id } = await params;

	const isExistItem = items?.find(({ id: id1 }) => id1 === parseInt(id));
	if (!isExistItem) {
		notFound();
	}
	return (
		<main>
			<HeaderSpace />
			<HeroInner title={"Team details"} text={"Team details"} />
			<TeamDetails1 currentItemId={parseInt(id)} />
			<Cta />
		</main>
	);
}
export async function generateStaticParams() {
	return items?.map(({ id }) => ({ id: id.toString() }));
}
