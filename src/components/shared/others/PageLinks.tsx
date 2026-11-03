import Link from "next/link";
import { pageWindow } from "@/libs/postList";

type Props = {
	page: number;
	pageCount: number;
	/** URL of a page number, keeping the other filters. */
	hrefFor: (page: number) => string;
};

// Bexon's pagination look (`.tj-pagination`) as real links rendered on the server, so every
// page has its own address and works without JavaScript.
export default function PageLinks({ page, pageCount, hrefFor }: Props) {
	if (pageCount <= 1) return null;
	return (
		<nav className="tj-pagination d-flex justify-content-center" aria-label="Phân trang">
			<ul>
				{page > 1 ? (
					<li>
						<Link className="page-numbers prev" href={hrefFor(page - 1)} scroll={false} aria-label="Trang trước">
							<i className="tji-arrow-left-long" aria-hidden="true"></i>
						</Link>
					</li>
				) : null}
				{pageWindow(page, pageCount).map((n, i) =>
					n === null ? (
						<li key={`gap-${i}`} aria-hidden="true">
							<span className="page-numbers dots">…</span>
						</li>
					) : (
						<li key={n}>
							<Link
								className={`page-numbers ${n === page ? "current" : ""}`}
								href={hrefFor(n)}
								scroll={false}
								aria-label={`Trang ${n}`}
								aria-current={n === page ? "page" : undefined}
							>
								{n}
							</Link>
						</li>
					),
				)}
				{page < pageCount ? (
					<li>
						<Link className="page-numbers next" href={hrefFor(page + 1)} scroll={false} aria-label="Trang sau">
							<i className="tji-arrow-right-long" aria-hidden="true"></i>
						</Link>
					</li>
				) : null}
			</ul>
		</nav>
	);
}
