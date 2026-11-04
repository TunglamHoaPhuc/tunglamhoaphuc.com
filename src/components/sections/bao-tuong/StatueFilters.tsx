"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import ButtonPrimary from "@/components/shared/buttons/ButtonPrimary";

type Option = { value: string; label: string };
type Values = { q: string; assembly: string; area: string; kind: string };

type Props = {
	/** The list path: the form's address without JavaScript, and where "Bỏ lọc" leads. */
	action: string;
	values: Values;
	assemblies: Option[];
	areas: Option[];
	kinds: Option[];
};

// The statue filters: a plain GET form, so they work without JavaScript. With it, only the
// fields that hold something go on the address (no "?q=&khu-vuc=") and the list reloads in
// place; the status line below announces the new count.
export default function StatueFilters({ action, values, assemblies, areas, kinds }: Props) {
	const router = useRouter();
	const [draft, setDraft] = useState(values);
	const [shownFor, setShownFor] = useState(JSON.stringify(values));
	// The page answered (Bỏ lọc, Back): show what the address says again.
	if (shownFor !== JSON.stringify(values)) {
		setShownFor(JSON.stringify(values));
		setDraft(values);
	}
	const filtered = !!(values.q || values.assembly || values.area || values.kind);
	const field = (key: keyof Values) => ({
		value: draft[key],
		onChange: (event: { target: { value: string } }) => setDraft({ ...draft, [key]: event.target.value }),
	});
	const select = (id: string, name: string, label: string, all: string, key: keyof Values, options: Option[]) => (
		<div className="tlhp-field">
			<label htmlFor={id}>{label}</label>
			<select id={id} name={name} {...field(key)}>
				<option value="">{all}</option>
				{options.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
		</div>
	);

	return (
		<form
			className="tlhp-statue-filters"
			action={action}
			method="get"
			role="search"
			aria-label="Lọc và tìm tôn tượng"
			onSubmit={(event) => {
				event.preventDefault();
				const params = new URLSearchParams();
				for (const [name, value] of new FormData(event.currentTarget)) {
					if (typeof value === "string" && value.trim()) params.set(name, value.trim());
				}
				const search = params.toString();
				router.push(search ? `${action}?${search}` : action, { scroll: false });
			}}
		>
			<div className="tlhp-field">
				<label htmlFor="loc-tim">Tên hoặc mã tượng</label>
				<input id="loc-tim" type="search" name="q" placeholder="Ví dụ: Quan Âm, TP0001" {...field("q")} />
			</div>
			{select("loc-chung-hoi", "chung-hoi", "Chúng hội", "Tất cả chúng hội", "assembly", assemblies)}
			{select("loc-khu-vuc", "khu-vuc", "Khu vực", "Tất cả khu vực", "area", areas)}
			{select("loc-loai", "loai", "Loại tượng", "Tất cả", "kind", kinds)}
			<div className="tlhp-statue-filters-actions">
				<ButtonPrimary type="submit" text="Lọc" />
				{filtered ? (
					<Link className="tlhp-statue-filters-reset" href={action} scroll={false}>
						Bỏ lọc
					</Link>
				) : null}
			</div>
		</form>
	);
}
