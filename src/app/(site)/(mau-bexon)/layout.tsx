import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { isPublicHost } from "@/libs/hosts";

// Bexon's own sample pages (/contact, /blogs, /services, /team, /history, /our-gallery,
// /portfolios). They stay as patterns for new pages and as fixtures for the tests, like
// /styleguide: reachable on preview hosts such as v2, 404 on the public site, never indexed.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function BexonSamplesLayout({ children }: { children: ReactNode }) {
	if (isPublicHost((await headers()).get("host"))) notFound();
	return children;
}
