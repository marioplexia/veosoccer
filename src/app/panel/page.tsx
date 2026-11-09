import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Panel() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("full_name, account_type").eq("id", user.id).single();
  const isClub = profile?.account_type === "club_owner";
  const { data: items } = isClub
    ? await supabase.from("teams").select("id, name").order("created_at")
    : await supabase.from("tournaments").select("id, name").order("created_at");

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
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

      <h2 className="mt-10 text-lg font-semibold text-slate-900">{isClub ? "Tus clubes" : "Tus torneos"}</h2>
      {items && items.length > 0 ? (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {items.map((i) => (
            <li key={i.id} className="rounded-xl border border-slate-200 p-4 font-medium text-slate-900">{i.name}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-slate-600">Todavía no tienes {isClub ? "ningún club" : "ningún torneo"}.</p>
      )}
    </main>
  );
}
