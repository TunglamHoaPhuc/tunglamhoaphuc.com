// next/link and next/image for tests that render components on the server without Next's router.
import { createElement } from "react";

export default function Link({ href, children, ...rest }) {
	return createElement("a", { href, ...rest }, children);
}
