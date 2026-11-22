// next/navigation for the tests: these calls throw in Next too (they end the render), so a test can tell which one a page chose.
export class NavigationSignal extends Error {
	constructor(kind, to) {
		super(`${kind}${to ? ` ${to}` : ""}`);
		this.kind = kind;
		this.to = to;
	}
}
export const notFound = () => {
	throw new NavigationSignal("notFound");
};
export const redirect = (to) => {
	throw new NavigationSignal("redirect", to);
};
export const permanentRedirect = (to) => {
	throw new NavigationSignal("permanentRedirect", to);
};
export const usePathname = () => "/";
export const useRouter = () => ({ push() {}, replace() {}, back() {} });
export const useParams = () => ({});
export const useSearchParams = () => new URLSearchParams();
