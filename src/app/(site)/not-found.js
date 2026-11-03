import NotFoundMain, { notFoundMetadata } from "@/components/sections/error/NotFoundMain";

export const metadata = notFoundMetadata;

// Inside the (site) layout, which already draws the header and footer.
export default function NotFound() {
	return <NotFoundMain />;
}
