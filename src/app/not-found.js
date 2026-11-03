import SiteShell from "@/components/layout/SiteShell";
import NotFoundMain, { notFoundMetadata } from "@/components/sections/error/NotFoundMain";

export const metadata = notFoundMetadata;

// For pages outside the route groups (/styleguide on the public host), which have no site
// frame of their own. Unknown addresses go to (site)/[...missing] instead.
export default function NotFound() {
	return (
		<SiteShell>
			<NotFoundMain />
		</SiteShell>
	);
}
