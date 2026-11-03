"use client";
import { useLightbox } from "@/hooks/useLightbox";
import { youtubeEmbed } from "@/libs/video";
import type { MediaImage, Video } from "@/libs/content/types";

type Props = { videos: Video[]; title: string; poster: MediaImage | null };

// Bexon's video popup: a picture with a play button that opens the video in the lightbox.
// The picture is the post's own banner, not YouTube's thumbnail, so nothing is asked of
// YouTube until the visitor presses play; then only youtube-nocookie.com is loaded.
export default function PostVideos({ videos, title, poster }: Props) {
	useLightbox(".tlhp-video");
	return (
		<ul className="tlhp-videos">
			{videos.map((video, index) => (
				<li key={video.id}>
					{/* An iframe slide (external), not GLightbox's Plyr player, which loads from youtube.com. */}
					<a className="tlhp-video" href={youtubeEmbed(video.id)} data-type="external" data-gallery="video">
						{poster ? (
							<img src={poster.src} alt="" width={480} height={270} loading="lazy" style={{ objectPosition: poster.position }} />
						) : (
							<span className="tlhp-video-noposter" />
						)}
						<span className="tlhp-video-play" aria-hidden="true">
							<i className="tji-play"></i>
						</span>
						<span className="visually-hidden">
							Xem video{videos.length > 1 ? ` ${index + 1}` : ""}: {title}
						</span>
					</a>
				</li>
			))}
		</ul>
	);
}
