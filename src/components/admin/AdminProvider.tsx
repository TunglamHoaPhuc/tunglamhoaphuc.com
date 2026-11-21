"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiClientError, setCsrf } from "./api";

export type Me = {
	user: { id: string; email: string; name: string; role: string; roleId: string | null };
	permissions: string[];
	mustChangePassword: boolean;
	mfaEnabled: boolean;
	csrfToken: string;
};

type State = { status: "loading" } | { status: "ready"; me: Me } | { status: "error"; message: string };

type Value = {
	me: Me;
	/** Whether the person may do `action` on `module` (for "own" rights: on something of theirs, which the server decides). */
	can: (module: string, action: string) => boolean;
	reload: () => Promise<void>;
	signOut: () => Promise<void>;
};

const Context = createContext<Value | null>(null);

export function useAdmin(): Value {
	const value = useContext(Context);
	if (!value) throw new Error("useAdmin outside AdminProvider");
	return value;
}

/** Loads who is signed in; sends a guest to the sign-in page. Renders its children only once there is a person. */
export function AdminProvider({ children }: { children: ReactNode }) {
	const router = useRouter();
	const pathname = usePathname();
	const [state, setState] = useState<State>({ status: "loading" });

	const load = useCallback(async () => {
		try {
			const me = await api<Me>("GET", "auth/me");
			setCsrf(me.csrfToken);
			setState({ status: "ready", me });
		} catch (error) {
			if (error instanceof ApiClientError && (error.status === 401 || error.status === 404)) {
				router.replace(`/quan-tri/dang-nhap?tiep=${encodeURIComponent(pathname)}`);
				return;
			}
			setState({ status: "error", message: error instanceof Error ? error.message : "Không tải được thông tin tài khoản." });
		}
	}, [router, pathname]);

	useEffect(() => {
		// Reads who is signed in once per mount (moving between admin pages keeps the shell); the state is set
		// when the request answers, not during the render, which is what the rule guards against.
		// eslint-disable-next-line react-hooks/set-state-in-effect
		void load();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const value = useMemo<Value | null>(() => {
		if (state.status !== "ready") return null;
		const granted = new Set(state.me.permissions);
		return {
			me: state.me,
			can: (module, action) => granted.has(`${module}.${action}`) || granted.has(`${module}.${action}:own`),
			reload: load,
			signOut: async () => {
				try {
					await api("POST", "auth/logout", {});
				} finally {
					setCsrf("");
					router.replace("/quan-tri/dang-nhap");
				}
			},
		};
	}, [state, load, router]);

	if (state.status === "error") {
		return (
			<div className="tq-center">
				<div className="tq-card tq-card--narrow">
					<h1 className="tq-h1">Không tải được trang quản trị</h1>
					<p className="tq-alert tq-alert--error" role="alert">{state.message}</p>
					<button type="button" className="tq-btn" onClick={() => { setState({ status: "loading" }); void load(); }}>Thử lại</button>
				</div>
			</div>
		);
	}
	if (!value) return <div className="tq-center"><p className="tq-muted" role="status">Đang tải…</p></div>;
	return <Context.Provider value={value}>{children}</Context.Provider>;
}
