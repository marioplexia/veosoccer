"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import AuthShell from "@/components/AuthShell";
import { createClient } from "@/lib/supabase/client";

type AccountType = "club_owner" | "tournament_owner";

const TYPES: { value: AccountType; title: string; desc: string; orgLabel: string }[] = [
  { value: "club_owner", title: "Dueño de un club", desc: "Gestiona tu club, sus equipos y sus partidos.", orgLabel: "Nombre del club" },
  { value: "tournament_owner", title: "Dueño de un torneo", desc: "Organiza un torneo con varios equipos y partidos.", orgLabel: "Nombre del torneo" },
];

const input = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";

export default function Registro() {
  const router = useRouter();
  const [type, setType] = useState<AccountType>("club_owner");
  const [fullName, setFullName] = useState("");
  const [org, setOrg] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const current = TYPES.find((t) => t.value === type)!;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { account_type: type, full_name: fullName.trim(), org_name: org.trim() },
      },
    });
    setLoading(false);
    if (error) return setError(error.message);
    // Supabase no revela si el correo ya existe: devuelve un usuario sin identidades.
    if (data.user && data.user.identities?.length === 0) {
      return setError("Ya existe una cuenta con ese correo. Prueba a iniciar sesión.");
    }
    if (data.session) return router.push("/panel");
    setSent(true);
  }

  if (sent) {
    return (
      <AuthShell title="Revisa tu correo">
        <p className="text-slate-600">
          Te enviamos un enlace de confirmación a <strong>{email}</strong>. Ábrelo para activar tu cuenta y entrar.
        </p>
        <Link href="/login" className="mt-6 inline-block font-semibold text-emerald-700 hover:underline">
          Ir a iniciar sesión
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Crea tu cuenta" subtitle="Elige cómo vas a usar VeoSoccer.">
      <form onSubmit={onSubmit} className="space-y-5">
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="sr-only">Tipo de cuenta</legend>
          {TYPES.map((t) => (
            <label
              key={t.value}
              className={`cursor-pointer rounded-xl border p-4 transition ${
                type === t.value ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-600/20" : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <input type="radio" name="type" value={t.value} checked={type === t.value} onChange={() => setType(t.value)} className="sr-only" />
              <span className="block font-semibold text-slate-900">{t.title}</span>
              <span className="mt-1 block text-sm text-slate-600">{t.desc}</span>
            </label>
          ))}
        </fieldset>

        <label className="block text-sm font-medium text-slate-700">
          Tu nombre
          <input className={input} value={fullName} onChange={(e) => setFullName(e.target.value)} required autoComplete="name" />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          {current.orgLabel}
          <input className={input} value={org} onChange={(e) => setOrg(e.target.value)} required maxLength={120} />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Correo electrónico
          <input type="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Contraseña
          <input type="password" className={input} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
          <span className="mt-1 block text-xs text-slate-500">Mínimo 8 caracteres.</span>
        </label>

        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <button disabled={loading} className="w-full rounded-full bg-emerald-600 px-6 py-3 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
          {loading ? "Creando cuenta…" : "Crear cuenta"}
        </button>
        <p className="text-center text-sm text-slate-600">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-semibold text-emerald-700 hover:underline">Entrar</Link>
        </p>
      </form>
    </AuthShell>
  );
}
