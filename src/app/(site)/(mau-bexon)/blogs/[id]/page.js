import BlogDetailsMain from "@/components/layout/main/BlogDetailsMain";
import Cta from "@/components/sections/cta/Cta";
import HeaderSpace from "@/components/shared/others/HeaderSpace";
import getBlogs from "@/libs/getBlogs";
import { notFound } from "next/navigation";
const items = getBlogs();

export default async function BlogDetails({ params }) {
	const { id } = await params;
	const isExistItem = items?.find(({ id: id1 }) => id1 === parseInt(id));
	if (!isExistItem) {
		notFound();
	}
	return (
		<main>
			<HeaderSpace />
			<BlogDetailsMain currentItemId={parseInt(id)} />
			<Cta />
		</main>
	);
}

export async function generateStaticParams() {
	return items?.map(({ id }) => ({ id: id.toString() }));
}
