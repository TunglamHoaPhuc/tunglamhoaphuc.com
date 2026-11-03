/**
 * Bexon's testimonial card as a verse of the month (Lời Thầy dạy): the quote mark, the verse
 * in the scripture style, its author and month.
 * @param {{ verse: import("@/libs/content/types").MonthTheme }} props
 */
const TestimonialsCard2 = ({ verse }) => {
	return (
		<figure className="testimonial-item tlhp-verse-card">
			<span className="quote-icon" aria-hidden="true">
				<i className="tji-quote"></i>
			</span>
			<blockquote className="desc tlhp-verse-text">
				{/* Lines are escaped by the schedule adapter; only <b> remains. */}
				{verse.lines.map((line, idx) => (
					<p key={idx} dangerouslySetInnerHTML={{ __html: line }} />
				))}
			</blockquote>
			<figcaption className="testimonial-author">
				<div className="author-inner">
					<div className="author-header">
						<p className="title h4">{verse.author || "Tùng Lâm Hòa Phúc"}</p>
						<span className="designation">
							Chủ đề tháng {verse.month}
							{verse.title ? `: ${verse.title}` : ""}
						</span>
					</div>
				</div>
			</figcaption>
		</figure>
	);
};

export default TestimonialsCard2;
