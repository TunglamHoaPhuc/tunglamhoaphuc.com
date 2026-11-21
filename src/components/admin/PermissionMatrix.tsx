"use client";

import { useMemo } from "react";

export type MatrixModule = { key: string; label: string };

type Props = {
	modules: MatrixModule[];
	actions: string[];
	/** Permission strings such as "posts.view" or "posts.update:own". */
	value: string[];
	onChange: (next: string[]) => void;
	readOnly?: boolean;
	/** False: the person lacks that right and so cannot hand it out. */
	canGrant?: (module: string, action: string) => boolean;
};

type Scope = "none" | "all" | "own";

const ACTION_LABELS: Record<string, string> = { view: "Xem", create: "Tạo", update: "Sửa", delete: "Xóa", publish: "Xuất bản" };
const OWN_ACTIONS = new Set(["view", "update", "delete"]);

const SCOPE_TEXT: Record<Scope, string> = { none: "—", all: "Tất cả", own: "Của mình" };

/** Splits "module.action[:own]"; null for anything malformed. */
function parse(entry: string): { module: string; action: string; own: boolean } | null {
	const own = entry.endsWith(":own");
	const [module, action, ...rest] = (own ? entry.slice(0, -4) : entry).split(".");
	return module && action && rest.length === 0 ? { module, action, own } : null;
}

const format = (module: string, action: string, own: boolean) => `${module}.${action}${own ? ":own" : ""}`;

/** Drops duplicates, and a "own" entry when the same right is also granted in full. */
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
		if (parsed.own && OWN_ACTIONS.has(parsed.action)) {
			if (!scopes.has(key)) scopes.set(key, "own");
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
			if (parsed.own && OWN_ACTIONS.has(parsed.action)) {
				if (map.get(key) !== "all") map.set(key, "own");
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
								const locked = readOnly || (canGrant ? !canGrant(module.key, action) : false);
								if (readOnly) {
									return <td key={action}>{OWN_ACTIONS.has(action) ? SCOPE_TEXT[scope] : scope === "none" ? "—" : "Có"}</td>;
								}
								return (
									<td key={action}>
										{OWN_ACTIONS.has(action) ? (
											<select aria-label={name} value={scope} disabled={locked} onChange={(event) => setScope(module.key, action, event.target.value as Scope)}>
												<option value="none">{SCOPE_TEXT.none}</option>
												<option value="all">{SCOPE_TEXT.all}</option>
												<option value="own">{SCOPE_TEXT.own}</option>
											</select>
										) : (
											<input type="checkbox" aria-label={name} checked={scope !== "none"} disabled={locked} onChange={(event) => setScope(module.key, action, event.target.checked ? "all" : "none")} />
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
