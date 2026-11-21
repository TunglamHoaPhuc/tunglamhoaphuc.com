import type { Metadata } from "next";
import { Suspense } from "react";
import ResetForm from "./ResetForm";

// The link carries a secret in its query string: keep it out of Referer headers.
export const metadata: Metadata = { title: "Đặt lại mật khẩu", referrer: "no-referrer" };

export default function ResetPasswordPage() {
	return (
		<Suspense>
			<ResetForm />
		</Suspense>
	);
}
