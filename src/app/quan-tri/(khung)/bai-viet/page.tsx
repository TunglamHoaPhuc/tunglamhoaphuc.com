"use client";

import { ContentList } from "@/components/admin/content/ContentList";
import { useAdmin } from "@/components/admin/AdminProvider";
import { Alert, PageHeader } from "@/components/admin/ui";

export default function ListPage() {
	const { can } = useAdmin();
	if (!can("posts", "view")) {
		return (
			<>
				<PageHeader title="Không có quyền truy cập" />
				<Alert kind="warning">Bạn không có quyền xem mục này.</Alert>
			</>
		);
	}
	return <ContentList kind="posts" />;
}
