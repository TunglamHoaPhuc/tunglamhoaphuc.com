import type { HomeQuote } from "@/libs/homeData";

/** One of the admin's quotations in the markup of Bexon's testimonial card (see TestimonialsCard2). The text is plain: React escapes it. */
export default function QuoteCard({ quote }: { quote: HomeQuote }) {
	const link = quote.sourceUrl && quote.source ? quote.sourceUrl : "";
	return (
		<figure className="testimonial-item tlhp-verse-card">
			<span className="quote-icon" aria-hidden="true">
				<i className="tji-quote"></i>
			</span>
			<blockquote className="desc tlhp-verse-text">
				{quote.text.split(/\n{2,}|\n/).map((line, index) => (
					<p key={index}>{line}</p>
				))}
			</blockquote>
			<figcaption className="testimonial-author">
				<div className="author-inner">
					<div className="author-header">
						<p className="title h4">{quote.author || "Tùng Lâm Hòa Phúc"}</p>
						{quote.source ? (
							<span className="designation">{link ? <a href={link}>{quote.source}</a> : quote.source}</span>
						) : null}
					</div>
				</div>
			</figcaption>
		</figure>
	);
}
