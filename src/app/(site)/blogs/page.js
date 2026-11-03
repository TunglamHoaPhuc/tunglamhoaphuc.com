import BlogMain from "@/components/layout/main/BlogMain";
import Cta from "@/components/sections/cta/Cta";
import HeaderSpace from "@/components/shared/others/HeaderSpace";
import { Suspense } from "react";

export default function Blogs() {
	return (
		<main>
			<HeaderSpace />
			{/* BlogMain reads the query string on the client; the root loading.js used to give it
			    this boundary. T7 replaces it with a list filtered on the server. */}
			<Suspense>
				<BlogMain />
			</Suspense>
			<Cta />
		</main>
	);
}
