"use client";
import { type CSSProperties, type ReactNode, useSyncExternalStore } from "react";

// Reading settings of the body text (BRAND-GUIDELINES Q14): four text sizes and three
// grounds, Ngà (the page), Giấy dó and Đêm thiền. They apply to this frame only (plan
// decision 9) and are remembered on this device.
const SIZES = [0.9, 1, 1.15, 1.3];
const DEFAULT_SIZE = 1;
const THEMES = [
	{ value: "nga", label: "Ngà" },
	{ value: "sepia", label: "Giấy dó" },
	{ value: "dark", label: "Đêm thiền" },
] as const;
type Theme = (typeof THEMES)[number]["value"];

const SIZE_KEY = "tlhp-reading-size";
const THEME_KEY = "tlhp-reading-theme";
// The site itself is dark (the look of the old site), so the frame starts on Đêm thiền.
const DEFAULT_THEME = "dark";
const DEFAULTS = `${DEFAULT_SIZE}|${DEFAULT_THEME}`;

// Runs as the page parses, before first paint, so a reader who chose Ngà or Giấy dó never
// sees the frame flash dark first.
// (No saved size means the default: `+null` would read as size 0.)
const SYNC_SCRIPT = `(function(){var f=document.currentScript.previousElementSibling;try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)}),r=localStorage.getItem(${JSON.stringify(SIZE_KEY)}),s=r===null?0:${JSON.stringify(SIZES)}[+r];if(t==="sepia"||t==="dark"||t==="nga")f.setAttribute("data-theme",t==="nga"?"light":t);if(s)f.style.setProperty("--tlhp-reading-scale",s)}catch(e){}})()`;

const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
	listeners.add(listener);
	window.addEventListener("storage", listener);
	return () => {
		listeners.delete(listener);
		window.removeEventListener("storage", listener);
	};
}
function snapshot(): string {
	try {
		return `${localStorage.getItem(SIZE_KEY) ?? DEFAULT_SIZE}|${localStorage.getItem(THEME_KEY) ?? DEFAULT_THEME}`;
	} catch {
		return DEFAULTS;
	}
}
function save(key: string, value: string) {
	try {
		localStorage.setItem(key, value);
	} catch {
		// Private mode: the choice still applies until the page is left.
	}
	listeners.forEach((listener) => listener());
}

export default function ReadingFrame({ children }: { children: ReactNode }) {
	const [storedSize, storedTheme] = useSyncExternalStore(subscribe, snapshot, () => DEFAULTS).split("|");
	const size = SIZES[Number(storedSize)] ? Number(storedSize) : DEFAULT_SIZE;
	const theme: Theme = THEMES.some((item) => item.value === storedTheme) ? (storedTheme as Theme) : DEFAULT_THEME;

	return (
		<div className="tlhp-reading-box">
			<div className="tlhp-reading-controls" role="group" aria-label="Tùy chọn đọc">
				<div className="tlhp-reading-size">
					{/* The name starts with what the button shows, for voice control ("bấm A trừ"). */}
					<button type="button" onClick={() => save(SIZE_KEY, String(size - 1))} disabled={size === 0}>
						A−<span className="visually-hidden"> thu nhỏ chữ</span>
					</button>
					<span aria-live="polite">Cỡ chữ {Math.round(SIZES[size] * 100)}%</span>
					<button type="button" onClick={() => save(SIZE_KEY, String(size + 1))} disabled={size === SIZES.length - 1}>
						A+<span className="visually-hidden"> phóng to chữ</span>
					</button>
				</div>
				<div className="tlhp-reading-themes" role="group" aria-label="Màu nền khung đọc">
					{THEMES.map((item) => (
						<button
							key={item.value}
							type="button"
							className={`tlhp-theme-${item.value}`}
							aria-pressed={theme === item.value}
							onClick={() => save(THEME_KEY, item.value)}
						>
							{item.label}
						</button>
					))}
				</div>
			</div>
			<div
				className="tlhp-reading-frame"
				data-theme={theme === "nga" ? "light" : theme}
				style={{ "--tlhp-reading-scale": SIZES[size] } as CSSProperties}
				// SYNC_SCRIPT may have set the saved choice before React took over.
				suppressHydrationWarning
			>
				{children}
			</div>
			<script dangerouslySetInnerHTML={{ __html: SYNC_SCRIPT }} />
		</div>
	);
}
