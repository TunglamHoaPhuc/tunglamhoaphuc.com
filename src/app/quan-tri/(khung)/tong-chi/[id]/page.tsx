"use client";

import { useParams } from "next/navigation";
import { ContentEditor } from "@/components/admin/content/ContentEditor";

export default function EditPage() {
	const params = useParams<{ id: string }>();
	const id = Array.isArray(params.id) ? params.id[0] : params.id;
	return <ContentEditor key={id} kind="teachings" id={id} />;
}
