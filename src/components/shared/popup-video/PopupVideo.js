"use client";
import { useLightbox } from "@/hooks/useLightbox";

// Bexon's lightbox for the ".glightbox" links inside, with TLHP's labels and focus handling.
const PopupVideo = ({ children }) => {
	useLightbox(".glightbox");
	return children;
};

export default PopupVideo;
