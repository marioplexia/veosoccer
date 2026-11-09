import Link from "next/link";
import { redirect } from "next/navigation";
import CreateTournament from "@/components/CreateTournament";
import { Card, Empty } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Panel() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("full_name, account_type").eq("id", user.id).single();
  const isClub = profile?.account_type === "club_owner";

  const [{ data: tournaments }, { data: clubs }] = await Promise.all([
    supabase.from("tournaments").select("id, name, start_date").order("created_at", { ascending: false }),
    isClub ? supabase.from("teams").select("id, name").order("created_at") : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-600">
            {isClub ? "Dueño de club" : "Dueño de torneo"}
          </p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Hola, {profile?.full_name || user.email}</h1>
        </div>
        <form action="/auth/logout" method="post">
          <button className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Cerrar sesión
          </button>
        </form>
      </div>

      <Card title="Tus torneos">
        {tournaments && tournaments.length > 0 ? (
          <ul className="mb-6 grid gap-3 sm:grid-cols-2">
            {tournaments.map((t) => (
              <li key={t.id}>
                <Link href={`/panel/torneos/${t.id}`} className="block rounded-xl border border-slate-200 p-4 transition hover:border-emerald-600 hover:bg-emerald-50/40">
                  <span className="block font-semibold text-slate-900">{t.name}</span>
                  <span className="mt-1 block text-sm text-slate-500">{t.start_date ? `Inicia el ${t.start_date}` : "Sin fecha de inicio"}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mb-6"><Empty>Todavía no tienes torneos. Crea el primero aquí abajo.</Empty></div>
        )}
        <CreateTournament />
      </Card>

      {isClub && (
        <Card title="Tus clubes">
          {clubs && clubs.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {clubs.map((c) => (
                <li key={c.id} className="rounded-xl border border-slate-200 p-4 font-medium text-slate-900">{c.name}</li>
              ))}
            </ul>
          ) : (
            <Empty>Todavía no tienes ningún club.</Empty>
          )}
        </Card>
      )}
    </main>
  );
}
