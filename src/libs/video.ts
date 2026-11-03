/** The privacy-enhanced YouTube embed, loaded only when a visitor opens the video. */
export function youtubeEmbed(id: string): string {
	return `https://www.youtube-nocookie.com/embed/${id}?rel=0`;
}
