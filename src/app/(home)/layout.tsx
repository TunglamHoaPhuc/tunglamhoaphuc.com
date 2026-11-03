import type { ReactNode } from "react";
import SiteShell from "@/components/layout/SiteShell";

// The home page: the transparent header floats over the dark hero.
export default function HomeLayout({ children }: { children: ReactNode }) {
	return <SiteShell headerType={2}>{children}</SiteShell>;
}
