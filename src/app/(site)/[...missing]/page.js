import { notFoundMetadata } from "@/components/sections/error/NotFoundMain";
import { notFound } from "next/navigation";

// vinext takes the 404 page's title from here rather than from not-found.js.
export const metadata = notFoundMetadata;

// Every address that matches no page lands here, so its 404 page gets the (site) frame
// (header and footer) like Bexon's inner pages. Without it the root not-found renders
// outside the route groups: bare in Next.js, inside the home layout in vinext.
export default function Missing() {
	notFound();
}
