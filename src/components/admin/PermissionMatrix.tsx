"use client";

import { useMemo } from "react";
import { isOwnable } from "@/admin/rbac/catalog";

export type MatrixModule = { key: string; label: string };

type Props = {
	modules: MatrixModule[];
	actions: string[];
	/** Permission strings such as "posts.view" or "posts.update:own". */
	value: string[];
	onChange: (next: string[]) => void;
	readOnly?: boolean;
	/**
	 * Whether the person can hand out `module.action` at that scope: with "own" they must hold it in any scope, with "all" they must hold it in full
	 * (a caller who holds only "của mình" cannot give "Tất cả"). Omitted: everything can be granted.
	 */
	canGrant?: (module: string, action: string, scope: "all" | "own") => boolean;
};

type Scope = "none" | "all" | "own";

const ACTION_LABELS: Record<string, string> = { view: "Xem", create: "Tạo", update: "Sửa", delete: "Xóa", publish: "Xuất bản" };
const SCOPE_TEXT: Record<Scope, string> = { none: "—", all: "Tất cả", own: "Của mình" };

/** Splits "module.action[:own]"; null for anything malformed. */
function parse(entry: string): { module: string; action: string; own: boolean } | null {
	const own = entry.endsWith(":own");
	const [module, action, ...rest] = (own ? entry.slice(0, -4) : entry).split(".");
	return module && action && rest.length === 0 ? { module, action, own } : null;
}

const format = (module: string, action: string, own: boolean) => `${module}.${action}${own ? ":own" : ""}`;

/**
 * Drops duplicates, an "own" entry when the same right is also granted in full, and an "own" entry on a right that has no such scope
 * (the server refuses it, and it was worth nothing: only the pairs of the catalogue's OWNABLE set honour "của mình").
 */
export function normalizePermissions(list: string[]): string[] {
	const scopes = new Map<string, "all" | "own">();
	const passthrough: string[] = [];
	for (const entry of list) {
		const parsed = parse(entry);
		if (!parsed) {
			if (!passthrough.includes(entry)) passthrough.push(entry);
			continue;
		}
		const key = `${parsed.module}.${parsed.action}`;
		if (parsed.own) {
			if (isOwnable(parsed.module, parsed.action) && !scopes.has(key)) scopes.set(key, "own");
		} else {
			scopes.set(key, "all");
		}
	}
	return [...[...scopes].map(([key, scope]) => (scope === "own" ? `${key}:own` : key)), ...passthrough];
}

export function PermissionMatrix({ modules, actions, value, onChange, readOnly = false, canGrant }: Props) {
	const scopes = useMemo(() => {
		const map = new Map<string, Scope>();
		for (const entry of value) {
			const parsed = parse(entry);
			if (!parsed) continue;
			const key = `${parsed.module}.${parsed.action}`;
			if (parsed.own) {
				if (isOwnable(parsed.module, parsed.action) && map.get(key) !== "all") map.set(key, "own");
			} else {
				map.set(key, "all");
			}
		}
		return map;
	}, [value]);

	const scopeOf = (module: string, action: string): Scope => scopes.get(`${module}.${action}`) ?? "none";

	function setScope(module: string, action: string, scope: Scope) {
		const rest = value.filter((entry) => {
			const parsed = parse(entry);
			return !(parsed && parsed.module === module && parsed.action === action);
		});
		onChange(normalizePermissions(scope === "none" ? rest : [...rest, format(module, action, scope === "own")]));
	}

	return (
		<div className="tq-table-wrap">
			<table className="tq-table tq-matrix">
				<thead>
					<tr>
						<th scope="col">Mục</th>
						{actions.map((action) => (
							<th scope="col" key={action}>{ACTION_LABELS[action] ?? action}</th>
						))}
					</tr>
				</thead>
				<tbody>
					{modules.map((module) => (
						<tr key={module.key}>
							<th scope="row">{module.label}</th>
							{actions.map((action) => {
								const scope = scopeOf(module.key, action);
								const name = `${module.label} – ${ACTION_LABELS[action] ?? action}`;
								const ownable = isOwnable(module.key, action);
								const mayAll = !canGrant || canGrant(module.key, action, "all");
								const mayOwn = ownable && (!canGrant || canGrant(module.key, action, "own"));
								const locked = !mayAll && !mayOwn;
								if (readOnly) {
									return <td key={action}>{ownable ? SCOPE_TEXT[scope] : scope === "none" ? "—" : "Có"}</td>;
								}
								return (
									<td key={action}>
										{ownable ? (
											// "Của mình" only where a handler checks the owner; "Tất cả" only for a person who holds it in full. What the role already has stays shown.
											<select aria-label={name} value={scope} disabled={locked} onChange={(event) => setScope(module.key, action, event.target.value as Scope)}>
												<option value="none">{SCOPE_TEXT.none}</option>
												<option value="all" disabled={!mayAll && scope !== "all"}>
													{SCOPE_TEXT.all}
												</option>
												<option value="own" disabled={!mayOwn && scope !== "own"}>
													{SCOPE_TEXT.own}
												</option>
											</select>
										) : (
											<input type="checkbox" aria-label={name} checked={scope !== "none"} disabled={!mayAll && scope === "none"} onChange={(event) => setScope(module.key, action, event.target.checked ? "all" : "none")} />
										)}
									</td>
								);
							})}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
