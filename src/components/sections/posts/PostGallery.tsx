"use client";
import { useEffect, useRef, useState } from "react";
import { useLightbox } from "@/hooks/useLightbox";
import { albumImageAt, IMAGE_WIDTH } from "@/libs/content/media";
import type { GalleryImage } from "@/libs/content/types";

const FIRST = 12;

type Props = { images: GalleryImage[]; title: string; albumId: string };

// The album: the first 12 photos, the rest behind "Xem thêm". A photo opens in Bexon's
// lightbox (useLightbox), which steps through the whole album, shown or not.
export default function PostGallery({ images, title, albumId }: Props) {
	const [showAll, setShowAll] = useState(false);
	const list = useRef<HTMLUListElement>(null);

	// "Xem thêm" disappears once pressed; carry keyboard focus on to the first new photo.
	useEffect(() => {
		if (showAll) list.current?.querySelectorAll<HTMLAnchorElement>("a")[FIRST]?.focus();
	}, [showAll]);

	useLightbox(`[data-gallery="${albumId}"]`);

	return (
		<>
			<ul className="tlhp-gallery" ref={list}>
				{images.map((image, index) => (
					<li key={image.src + index} hidden={!showAll && index >= FIRST}>
						<a
							href={albumImageAt(image.src, IMAGE_WIDTH.full)}
							className="tlhp-gallery-item"
							data-gallery={albumId}
							data-title={image.caption || image.title || title}
							data-alt={`${image.caption || image.title || title} – ảnh ${index + 1}`}
						>
							<img
								src={albumImageAt(image.src, IMAGE_WIDTH.card)}
								alt={`${image.caption || image.title || title} – ảnh ${index + 1}`}
								width={400}
								height={300}
								loading="lazy"
								decoding="async"
							/>
						</a>
					</li>
				))}
			</ul>
			{!showAll && images.length > FIRST ? (
				<div className="tlhp-gallery-more">
					<button type="button" className="tj-primary-btn transparent-btn" onClick={() => setShowAll(true)}>
						<span className="btn-text">
							<span>Xem thêm {images.length - FIRST} ảnh</span>
						</span>
						<span className="btn-icon" aria-hidden="true">
							<i className="tji-arrow-down-long"></i>
						</span>
					</button>
				</div>
			) : null}
		</>
	);
}
