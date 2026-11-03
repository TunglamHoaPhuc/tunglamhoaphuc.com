import type { ReactNode } from "react";
import SiteShell from "@/components/layout/SiteShell";

// Inner pages: the solid header, since they have no dark hero to float over.
export default function SiteLayout({ children }: { children: ReactNode }) {
	return <SiteShell>{children}</SiteShell>;
}
