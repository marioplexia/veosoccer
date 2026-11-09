import Link from "next/link";

const NAV = [
  { href: "#productos", label: "Productos" },
  { href: "#editor", label: "Editor" },
  { href: "#analitica", label: "Analítica" },
  { href: "#deportes", label: "Deportes" },
];

const EDITOR = [
  ["Eventos manuales y con IA", "Marca goles, tiros, córners y faltas sobre la línea de tiempo y filtra por tipo, equipo o jugador."],
  ["Seguimiento de la jugada", "Una vista que sigue la acción como una retransmisión, con control manual para recorrer todo el campo."],
  ["Clips y descargas", "Crea clips de cualquier momento, ponles etiquetas y descárgalos en MP4 para compartirlos."],
  ["Dibujo y notas", "Señala jugadores, dibuja flechas y formas y toma notas fechadas mientras revisas el partido."],
  ["Modo salto", "Omite los tiempos muertos y navega con cronología del partido y velocidad de reproducción ajustable."],
  ["Equipo y roles", "Gestiona plantilla, capitán y jugador del partido, con distintos niveles de permisos."],
];

const ANALYTICS = [
  ["Informe del partido", "Un resumen automático por pestañas; cada estadística te lleva al momento exacto en el video."],
  ["Mapas visuales", "Mapas de calor, de tiros y de pases enlazados directamente con el video."],
  ["Asistente del entrenador", "Consulta datos de uno o varios partidos y obtén ideas tácticas al instante."],
  ["Seguimiento de jugador", "Elige a cualquier jugador y consulta su velocidad y distancia recorrida."],
  ["Evolución de la temporada", "Compara equipos y sigue las métricas clave partido a partido."],
];

const SPORTS = ["Fútbol", "Fútbol sala", "Rugby", "Baloncesto", "Hockey", "Béisbol", "Fútbol americano", "Otros deportes"];

function Placeholder({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-emerald-700 to-slate-900 ${className}`}
    >
      <div className="absolute inset-4 rounded-xl border border-white/30" />
      <div className="absolute left-1/2 top-4 bottom-4 w-px bg-white/30" />
      <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30" />
    </div>
  );
}

export default function Home() {
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="text-xl font-extrabold tracking-tight text-slate-900">
            Veo<span className="text-emerald-600">Soccer</span>
          </Link>
          <nav className="hidden gap-8 text-sm font-medium text-slate-600 md:flex">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="hover:text-slate-900">
                {n.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-sm font-semibold">
            <Link href="/login" className="text-slate-700 hover:text-slate-900">
              Entrar
            </Link>
            <Link href="/registro" className="rounded-full bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700">
              Empezar
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="bg-slate-950 text-white">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 md:grid-cols-2 md:py-28">
            <div>
              <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-emerald-400">
                Para equipos y clubes
              </p>
              <h1 className="text-4xl font-extrabold leading-tight md:text-6xl">
                Tus partidos, grabados, analizados y compartidos.
              </h1>
              <p className="mt-6 max-w-xl text-lg text-slate-300">
                Sube cada partido, marca los momentos clave, crea clips y descubre qué hacer para mejorar. Todo tu equipo en un solo lugar.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link href="/registro" className="rounded-full bg-emerald-500 px-6 py-3 font-semibold text-slate-950 hover:bg-emerald-400">
                  Crear mi equipo
                </Link>
                <a href="#productos" className="rounded-full border border-white/30 px-6 py-3 font-semibold hover:bg-white/10">
                  Ver cómo funciona
                </a>
              </div>
            </div>
            <Placeholder className="aspect-video w-full shadow-2xl" />
          </div>
        </section>

        <section id="productos" className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">Graba, analiza, comparte</h2>
          <p className="mt-3 max-w-2xl text-slate-600">Un flujo completo desde que termina el partido hasta que el equipo ve los highlights.</p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              ["Graba", "Sube la grabación de tu partido desde cualquier dispositivo y organízala por equipo y rival."],
              ["Analiza", "Marca eventos, revisa jugadas y consulta estadísticas y mapas del partido."],
              ["Comparte", "Envía clips y highlights a jugadores, familias y cuerpo técnico en segundos."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-2xl border border-slate-200 p-6 shadow-sm">
                <div className="mb-4 h-10 w-10 rounded-full bg-emerald-100" />
                <h3 className="text-xl font-semibold text-slate-900">{t}</h3>
                <p className="mt-2 text-slate-600">{d}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="editor" className="bg-slate-50 py-20">
          <div className="mx-auto max-w-6xl px-6">
            <p className="text-sm font-semibold uppercase tracking-widest text-emerald-600">Editor</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900 md:text-4xl">Revisa cada partido en un solo lugar</h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {EDITOR.map(([t, d]) => (
                <article key={t} className="rounded-2xl bg-white p-6 shadow-sm">
                  <h3 className="font-semibold text-slate-900">{t}</h3>
                  <p className="mt-2 text-sm text-slate-600">{d}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="analitica" className="mx-auto max-w-6xl px-6 py-20">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-600">Analítica</p>
          <h2 className="mt-2 text-3xl font-bold text-slate-900 md:text-4xl">Convierte cada partido en datos útiles</h2>
          <div className="mt-10 grid items-start gap-10 md:grid-cols-2">
            <Placeholder className="aspect-[4/3] w-full" />
            <ul className="space-y-6">
              {ANALYTICS.map(([t, d]) => (
                <li key={t}>
                  <h3 className="font-semibold text-slate-900">{t}</h3>
                  <p className="mt-1 text-slate-600">{d}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="deportes" className="bg-slate-950 py-20 text-white">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-3xl font-bold md:text-4xl">Pensado para tu deporte</h2>
            <div className="mt-8 flex flex-wrap gap-3">
              {SPORTS.map((s) => (
                <span key={s} className="rounded-full border border-white/20 px-5 py-2 text-sm">
                  {s}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-6 py-24 text-center">
          <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">Empieza con tu próximo partido</h2>
          <p className="mx-auto mt-4 max-w-xl text-slate-600">Crea tu equipo, sube un partido y marca tu primer evento en minutos.</p>
          <Link href="/registro" className="mt-8 inline-block rounded-full bg-emerald-600 px-8 py-3 font-semibold text-white hover:bg-emerald-700">
            Crear mi equipo
          </Link>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-10 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} VeoSoccer. Todos los derechos reservados.
      </footer>
    </>
  );
}
