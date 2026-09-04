import { sql } from "@/lib/db";
import { TemplatesEditor, type Template } from "./templates-editor";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const templates = await sql<Template[]>`
    select id, name, subject_tpl, body_tpl, kind, is_default
    from templates order by kind, is_default desc, name
  `;

  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-sm font-semibold uppercase tracking-widest opacity-60">
        Templates
      </h1>
      <TemplatesEditor templates={templates} />
    </main>
  );
}
