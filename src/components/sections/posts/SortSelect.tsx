"use client";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

type Props = {
	value: string;
	options: { param: string; label: string; href: string }[];
	/** The list path and the category to keep, for the form without JavaScript. */
	action: string;
	category: string;
};

// A native <select>: picking an order reloads the list in place (focus stays here). Arrow
// keys on a closed select fire a change per press, so wait a moment before loading.
// Without JavaScript the form and its button do the same.
export default function SortSelect({ value, options, action, category }: Props) {
	const router = useRouter();
	const id = useId();
	const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
	const [picked, setPicked] = useState<string | null>(null);
	const [shownFor, setShownFor] = useState(value);
	// The page answered (or Back was pressed): show what the URL says again.
	if (shownFor !== value) {
		setShownFor(value);
		setPicked(null);
	}
	useEffect(() => () => clearTimeout(timer.current), []);

	return (
		<form className="tlhp-sort" action={action} method="get">
			{category ? <input type="hidden" name="danh-muc" value={category} /> : null}
			<label htmlFor={id}>Sắp xếp</label>
			<select
				id={id}
				name="sap-xep"
				value={picked ?? value}
				onChange={(event) => {
					const param = event.target.value;
					setPicked(param);
					clearTimeout(timer.current);
					const href = options.find((option) => option.param === param)?.href;
					if (href) timer.current = setTimeout(() => router.push(href, { scroll: false }), 300);
				}}
			>
				{options.map((option) => (
					<option key={option.param} value={option.param}>
						{option.label}
					</option>
				))}
			</select>
			<noscript>
				<button type="submit" className="tlhp-sort-submit">
					Áp dụng
				</button>
			</noscript>
		</form>
	);
}
