import type { MonthTheme as Theme } from "@/libs/content/types";
import { IMAGE_WIDTH, imageAt } from "@/libs/content/media";

// The month's theme beside the calendar: its poster and the verse in the scripture style.
export default function MonthTheme({ theme }: { theme: Theme }) {
	const title = theme.title || `Tháng ${theme.month}`;
	return (
		<aside className="tlhp-month-theme tlhp-dark" aria-labelledby="chu-de-thang">
			{theme.poster ? (
				<img className="tlhp-month-theme-poster" src={imageAt(theme.poster, IMAGE_WIDTH.wide)} alt={`Tranh chủ đề tháng ${theme.month}: ${title}`} width={1200} height={1015} loading="lazy" decoding="async" />
			) : null}
			<div className="tlhp-month-theme-body">
				<p className="tlhp-month-theme-overline">Chủ đề tháng {theme.month}</p>
				<h2 id="chu-de-thang" className="tlhp-month-theme-title h4">
					{title}
				</h2>
				{theme.lines.length ? (
					<figure className="tlhp-verse">
						<blockquote>
							{/* Lines are escaped by the schedule adapter; only <b> remains. */}
							{theme.lines.map((line, idx) => (
								<p key={idx} dangerouslySetInnerHTML={{ __html: line }} />
							))}
						</blockquote>
						{theme.author ? <figcaption>— {theme.author}</figcaption> : null}
					</figure>
				) : null}
			</div>
		</aside>
	);
}
