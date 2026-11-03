"use client";
import { useLightbox } from "@/hooks/useLightbox";

// For server-rendered links (photos, video embeds) that should open in the lightbox.
export default function LightboxLinks({ selector }: { selector: string }) {
	useLightbox(selector);
	return null;
}
