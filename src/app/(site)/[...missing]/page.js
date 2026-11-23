import { notFoundMetadata } from "@/components/sections/error/NotFoundMain";
import { notFound } from "next/navigation";
import { redirectIfMoved } from "@/libs/siteRedirect";

// vinext takes the 404 page's title from here rather than from not-found.js.
export const metadata = notFoundMetadata;

const decode = (segment) => {
	try {
		return decodeURIComponent(segment);
	} catch {
		return segment;
	}
};

// Every address that matches no page lands here, so its 404 page gets the (site) frame
// (header and footer) like Bexon's inner pages. Without it the root not-found renders
// outside the route groups: bare in Next.js, inside the home layout in vinext.
//
// Before giving up, the redirect table is asked once (only when the site reads from D1): an address the
// admin moved answers with its redirect instead of a 404.
export default async function Missing({ params }) {
	const segments = (await params)?.missing ?? [];
	if (segments.length) await redirectIfMoved(`/${segments.map(decode).join("/")}`);
	notFound();
}
