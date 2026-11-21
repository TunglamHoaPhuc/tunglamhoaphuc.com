"use client";

import { useParams } from "next/navigation";
import { AreaForm } from "@/components/admin/special/AreaForm";

export default function AreaPage() {
	const params = useParams<{ id: string }>();
	const id = Array.isArray(params.id) ? params.id[0] : params.id;
	return <AreaForm key={id} id={id} />;
}
