"use client";

import { useParams } from "next/navigation";
import { StatueForm } from "@/components/admin/special/StatueForm";

export default function StatuePage() {
	const params = useParams<{ id: string }>();
	const id = Array.isArray(params.id) ? params.id[0] : params.id;
	return <StatueForm key={id} id={id} />;
}
