import { sql } from "@/lib/db";
import { ContactsTable, type Contact } from "./contacts-table";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const contacts = await sql<Contact[]>`
    select id, email, first_name, last_name, company, role, notes
    from contacts
    order by coalesce(first_name, email)
  `;

  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-sm font-semibold uppercase tracking-widest opacity-60">
        Contacts
      </h1>
      <ContactsTable contacts={contacts} />
    </main>
  );
}
