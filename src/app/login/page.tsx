"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import AuthShell from "@/components/AuthShell";
import { createClient } from "@/lib/supabase/client";

const input = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      return setError(error.message === "Email not confirmed" ? "Confirma tu correo antes de entrar." : "Correo o contraseña incorrectos.");
    }
    router.push("/panel");
    router.refresh();
  }

  return (
    <AuthShell title="Entrar" subtitle="Accede a tu cuenta de VeoSoccer.">
      <form onSubmit={onSubmit} className="space-y-5">
        <label className="block text-sm font-medium text-slate-700">
          Correo electrónico
          <input type="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Contraseña
          <input type="password" className={input} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </label>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button disabled={loading} className="w-full rounded-full bg-emerald-600 px-6 py-3 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
          {loading ? "Entrando…" : "Entrar"}
        </button>
        <p className="text-center text-sm text-slate-600">
          ¿No tienes cuenta?{" "}
          <Link href="/registro" className="font-semibold text-emerald-700 hover:underline">Crear cuenta</Link>
        </p>
      </form>
    </AuthShell>
  );
}
