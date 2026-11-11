import Link from "next/link";
import { Outfit } from "next/font/google";

const outfit = Outfit({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

/* Degradados de la plataforma (los mismos tres temas de los marcadores). */
const G = {
  cyan: "linear-gradient(135deg,#0BEDFE 0%,#33A7FE 45%,#843EFF 100%)",
  orange: "linear-gradient(135deg,#FF6E11 0%,#E93F6E 50%,#A135E0 100%)",
  green: "linear-gradient(135deg,#E3FF01 0%,#12FF6B 55%,#07F4D0 100%)",
};
const INK = "#37003C";

const TOP_LINKS = [
  { href: "#torneos", label: "Torneos" },
  { href: "#clubes", label: "Clubes" },
  { href: "#transmision", label: "Transmisión" },
  { href: "#estudio", label: "Estudio de marca" },
  { href: "#funciones", label: "Funciones" },
];

const NAV = [
  { href: "/partidos", label: "Partidos" },
  { href: "#tabla", label: "Tabla" },
  { href: "#torneos", label: "Torneos" },
  { href: "#transmision", label: "Transmisión" },
  { href: "#estudio", label: "Estudio" },
  { href: "#clubes", label: "Clubes" },
];

const SIDE_STORIES = [
  { tag: "Transmisión", title: "Transmite a Facebook con un clic y un director automático", href: "#transmision", art: G.orange },
  { tag: "Estudio", title: "Videos de gol, medio tiempo y tablas con tus colores", href: "#estudio", art: G.green },
  { tag: "Torneos", title: "Sube una foto de tu rol y la IA arma equipos, canchas y calendario", href: "#torneos", art: G.cyan },
  { tag: "Clubes", title: "Graba, marca jugadas y comparte clips con tu equipo", href: "#clubes", art: G.orange },
];

const FEATURES = [
  ["📅", "Calendario automático"],
  ["🏆", "Tabla en vivo"],
  ["📡", "En vivo a Facebook"],
  ["🎬", "Animaciones de marca"],
  ["🛡️", "Escudos con IA"],
  ["📺", "Carteles LED"],
  ["🧩", "Divisiones"],
  ["👥", "Plantillas"],
  ["🖼️", "Pósters"],
];

const MATCHES = [
  ["Leones", "Tigres", 2, 1],
  ["Águilas", "Halcones", 0, 0],
  ["Lobos", "Toros", 3, 2],
  ["Búhos", "Pumas", 1, 4],
] as const;

const TABLE = [
  ["Leones", 6, 12, 16],
  ["Águilas", 6, 9, 13],
  ["Lobos", 6, 6, 12],
  ["Búhos", 6, 3, 10],
  ["Pumas", 6, 0, 8],
] as const;

type CardT = { tag: string; title: string; text: string; art: string };
const TOURNAMENT_CARDS: CardT[] = [
  { tag: "Tablero", title: "Todo tu torneo en un tablero", text: "Equipos, canchas, calendario, resultados y posiciones, siempre al día.", art: G.cyan },
  { tag: "Divisiones", title: "Una liga, varias divisiones", text: "Premier, Segundas, Terceras… cada una con su calendario y su tabla.", art: G.green },
  { tag: "IA", title: "Importa desde una imagen", text: "Sube la foto de tu rol de juegos y deja que la IA distribuya equipos y canchas.", art: G.orange },
  { tag: "Equipos", title: "Escudos y plantillas", text: "Sube los escudos o pide a la IA que los diseñe, y guarda a cada jugador con su dorsal.", art: G.cyan },
];
const LIVE_CARDS: CardT[] = [
  { tag: "En vivo", title: "Elige el partido y pulsa Iniciar", text: "Tu teléfono es la cámara; la señal sale a Facebook con el marcador puesto.", art: G.orange },
  { tag: "Director", title: "Un director automático", text: "Lanza la intro, las alineaciones, los goles, el medio tiempo y el final por ti.", art: G.cyan },
  { tag: "Patrocinios", title: "Anuncios como en la tele", text: "Tarjetas de patrocinador y carteles LED a pie de cancha durante el partido.", art: G.green },
  { tag: "Simulador", title: "Mira antes de salir al aire", text: "Reproduce una transmisión de prueba con todas las animaciones y anuncios.", art: G.orange },
];
const STUDIO_CARDS: CardT[] = [
  { tag: "Marca", title: "Tus colores y tipografías", text: "Define la identidad del torneo y de la transmisión con selector de color y código.", art: G.green },
  { tag: "Videos", title: "Gol, tarjetas, cambios y más", text: "Animaciones listas para descargar en horizontal, vertical y cuadrado.", art: G.orange },
  { tag: "Pósters", title: "Partido, equipo ideal y jugador", text: "Imágenes para redes con escudos, fotos y formación.", art: G.cyan },
  { tag: "Tablas", title: "Resultados y posiciones animados", text: "Diez segundos de tabla con escudos, lista para la transmisión.", art: G.green },
];
const CLUB_CARDS: CardT[] = [
  { tag: "Video", title: "Sube cada partido", text: "Todo tu equipo ve el partido completo desde cualquier lugar.", art: G.cyan },
  { tag: "Eventos", title: "Marca los momentos clave", text: "Goles, tiros, córners y faltas sobre la línea de tiempo.", art: G.orange },
  { tag: "Clips", title: "Crea y comparte clips", text: "Recorta cualquier jugada, ponle título y compártela.", art: G.green },
  { tag: "Notas", title: "Notas del entrenador", text: "Apuntes fechados en el minuto exacto del video.", art: G.cyan },
];

const FOOT = [
  [["VeoSoccer", "/"], ["Crear cuenta", "/registro"], ["Entrar", "/login"]],
  [["Torneos", "#torneos"], ["Transmisión", "#transmision"], ["Estudio de marca", "#estudio"]],
  [["Clubes", "#clubes"], ["Partidos", "#partidos"], ["Tabla", "#tabla"]],
] as const;

function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden className="grid h-9 w-9 place-items-center rounded-full text-sm font-bold text-white" style={{ background: light ? "rgba(255,255,255,.18)" : INK }}>VS</span>
      <span className="text-[19px] font-bold leading-[1.02] tracking-tight" style={{ color: light ? "#fff" : INK }}>Veo<br />Soccer</span>
    </span>
  );
}

/** Arte de portada: degradado con rayos diagonales, en lugar de una foto. */
function Art({ bg, className = "" }: { bg: string; className?: string }) {
  return (
    <div aria-hidden className={`relative overflow-hidden ${className}`} style={{ background: bg }}>
      <div className="absolute -right-[10%] top-0 h-full w-[26%] -skew-x-[28deg] bg-white/20" />
      <div className="absolute right-[24%] top-0 h-full w-[9%] -skew-x-[28deg] bg-white/15" />
      <div className="absolute left-[8%] top-0 h-full w-[14%] -skew-x-[28deg] bg-black/5" />
    </div>
  );
}

function Crest({ name }: { name: string }) {
  return <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: INK }}>{name.slice(0, 1)}</span>;
}

function Section({ id, title, cards, more }: { id: string; title: string; cards: CardT[]; more: string }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-2xl bg-white p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-[22px] font-semibold tracking-tight">{title}</h2>
        <Link href="/registro" className="shrink-0 text-sm font-medium hover:underline">{more} →</Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.title} href="/registro" className="group block min-w-0">
            <Art bg={c.art} className="aspect-[16/10] rounded-xl transition group-hover:brightness-105" />
            <p className="mt-3 text-xs font-medium opacity-70">{c.tag}</p>
            <h3 className="mt-1 text-[17px] font-semibold leading-snug group-hover:underline">{c.title}</h3>
            <p className="mt-1 text-sm leading-relaxed opacity-75">{c.text}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <div className={`${outfit.className} min-h-screen`} style={{ background: "#F9F8FA", color: INK }}>
      {/* barra superior */}
      <div className="hidden border-b border-black/5 text-[13px] md:block">
        <div className="mx-auto flex h-10 max-w-[1440px] items-center justify-between px-4">
          <nav aria-label="Secciones" className="flex gap-7">
            <span className="font-medium">VeoSoccer</span>
            {TOP_LINKS.map((l) => <a key={l.href} href={l.href} className="opacity-80 hover:opacity-100">{l.label}</a>)}
          </nav>
          <span className="font-medium">Para ligas y clubes locales</span>
        </div>
      </div>

      {/* navegación principal */}
      <header className="sticky top-0 z-30 border-b border-black/5 bg-white/95 shadow-[0_4px_12px_rgba(55,0,60,.06)] backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center gap-4 px-4">
          <Link href="/" aria-label="VeoSoccer, inicio"><Wordmark /></Link>
          <nav aria-label="Principal" className="ml-6 hidden items-center gap-8 text-[15px] font-semibold lg:flex">
            {NAV.map((n) => <Link key={n.href} href={n.href} className="hover:underline">{n.label}</Link>)}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm font-medium">
            <Link href="/registro" className="rounded-full p-[1.5px]" style={{ background: "linear-gradient(90deg,#0BEDFE,#843EFF,#FF6E11)" }}>
              <span className="block rounded-full bg-white px-4 py-2">Crear cuenta</span>
            </Link>
            <Link href="/login" className="px-1 hover:underline">Entrar</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] space-y-4 px-3 pb-10 pt-4 sm:px-4">
        <Link href="/registro" className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold text-white" style={{ background: INK }}>
          Crea tu torneo gratis <span aria-hidden>→</span>
        </Link>

        {/* portada */}
        <section className="grid gap-4 rounded-2xl bg-[#F1EFF3] p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Link href="/registro" className="group relative flex min-h-[420px] flex-col justify-end overflow-hidden rounded-2xl text-white sm:min-h-[560px]" style={{ background: "#2A0030" }}>
            <Art bg={G.cyan} className="absolute inset-x-0 top-0 h-[62%]" />
            <div className="absolute inset-x-0 top-[30%] h-[40%]" style={{ background: "linear-gradient(180deg,rgba(42,0,48,0),#2A0030)" }} />
            <div className="relative p-6 sm:p-8">
              <h1 className="max-w-xl text-3xl font-semibold leading-tight tracking-tight group-hover:underline sm:text-[40px]">Tu liga, con imagen de primera división</h1>
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/75">Organiza el torneo, lleva resultados y posiciones, crea tus gráficos y transmite cada partido en vivo. Todo desde un solo lugar.</p>
              <p className="mt-4 text-xs font-medium text-white/80">Plataforma</p>
            </div>
          </Link>
          <div className="grid gap-4 sm:grid-cols-2">
            {SIDE_STORIES.map((s) => (
              <a key={s.title} href={s.href} className="group flex min-w-0 flex-col overflow-hidden rounded-2xl bg-white">
                <Art bg={s.art} className="aspect-[16/9]" />
                <div className="flex flex-1 flex-col p-4">
                  <h2 className="text-[17px] font-semibold leading-snug group-hover:underline">{s.title}</h2>
                  <p className="mt-auto pt-3 text-xs font-medium opacity-70">{s.tag}</p>
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* franja de funciones */}
        <section id="funciones" aria-label="Funciones" className="scroll-mt-24 overflow-hidden rounded-2xl bg-white">
          <div className="h-2" style={{ background: "linear-gradient(90deg,#37003C,#963CFF)" }} />
          <ul className="grid grid-cols-3 gap-y-5 px-3 py-5 text-center sm:grid-cols-5 lg:grid-cols-9">
            {FEATURES.map(([icon, label]) => (
              <li key={label} className="px-1">
                <span aria-hidden className="block text-2xl">{icon}</span>
                <span className="mt-2 block text-xs opacity-80">{label}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* partidos y tabla */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <section id="partidos" className="scroll-mt-24 rounded-2xl bg-white p-4 sm:p-5">
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <h2 className="text-[22px] font-semibold tracking-tight">Partidos</h2>
              <Link href="/partidos" className="text-sm font-medium hover:underline">Ver todos los partidos →</Link>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {MATCHES.map(([h, a, hs, as]) => (
                <li key={h} className="flex items-center justify-between gap-2 rounded-xl border border-black/5 bg-[#F9F8FA] px-3 py-3 text-[15px] font-semibold">
                  <span className="flex min-w-0 flex-1 items-center justify-end gap-2"><span className="truncate">{h}</span><Crest name={h} /></span>
                  <span className="rounded-md px-2.5 py-1 text-sm text-white" style={{ background: INK }}>{hs} - {as}</span>
                  <span className="flex min-w-0 flex-1 items-center gap-2"><Crest name={a} /><span className="truncate">{a}</span></span>
                </li>
              ))}
            </ul>
            {/* marcador de transmisión, con el tema cian */}
            <div className="mt-5 overflow-hidden rounded-xl" style={{ background: "#0B0F19" }}>
              <div className="px-4 pb-9 pt-6">
                <div className="relative mx-auto max-w-xl">
                  <div className="flex h-9 items-center justify-center gap-3 text-sm font-bold sm:text-base" style={{ background: "linear-gradient(90deg,#0BEDFE,#33A7FE 55%,#843EFF)", color: INK }}>
                    <span>Leones</span><span className="text-lg">2</span>
                    <span aria-hidden className="grid h-10 w-10 place-items-center rounded-full border-2 border-white text-[10px] text-white" style={{ background: INK }}>VS</span>
                    <span className="text-lg">1</span><span>Tigres</span>
                  </div>
                  <div className="h-6 bg-white" />
                  <div className="absolute left-1/2 top-8 -translate-x-1/2 rounded-b-md px-5 py-1.5 text-xs font-semibold text-white" style={{ background: INK }}>Final</div>
                </div>
              </div>
              <p className="px-4 pb-3 text-center text-xs text-white/60">Así se ve el marcador en tu transmisión</p>
            </div>
          </section>

          <section id="tabla" className="scroll-mt-24 rounded-2xl bg-white p-4 sm:p-5">
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <h2 className="text-[22px] font-semibold tracking-tight">Tabla</h2>
              <span className="text-xs opacity-60">Ejemplo</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/10 text-left text-xs opacity-60">
                  <th className="py-2 font-medium">Pos</th><th className="font-medium">Equipo</th>
                  <th className="text-center font-medium">PJ</th><th className="text-center font-medium">DG</th><th className="text-center font-medium">Pts</th>
                </tr>
              </thead>
              <tbody>
                {TABLE.map(([team, pj, dg, pts], k) => (
                  <tr key={team} className="border-b border-black/5 last:border-0">
                    <td className="py-2.5 font-semibold">{k + 1}</td>
                    <td><span className="flex items-center gap-2 font-semibold"><Crest name={team} />{team}</span></td>
                    <td className="text-center">{pj}</td><td className="text-center">{dg > 0 ? `+${dg}` : dg}</td>
                    <td className="text-center font-bold">{pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs opacity-60">Se calcula sola con cada resultado que registras.</p>
          </section>
        </div>

        <Section id="torneos" title="Para dueños de torneo" cards={TOURNAMENT_CARDS} more="Crear mi torneo" />
        <Section id="transmision" title="Transmisión en vivo" cards={LIVE_CARDS} more="Empezar a transmitir" />

        {/* llamada a la acción */}
        <section className="relative overflow-hidden rounded-2xl px-6 py-10 text-white sm:px-10" style={{ background: INK }}>
          <div aria-hidden className="absolute -right-10 top-0 h-full w-1/2 -skew-x-[28deg] opacity-80" style={{ background: G.orange }} />
          <div className="relative max-w-xl">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Empieza hoy con tu torneo o tu club</h2>
            <p className="mt-2 text-white/80">Crea tu cuenta como dueño de torneo o dueño de club y arma tu primer calendario en minutos.</p>
            <div className="mt-5 flex flex-wrap gap-3 text-sm font-semibold">
              <Link href="/registro" className="rounded-full bg-white px-5 py-2.5" style={{ color: INK }}>Crear cuenta</Link>
              <Link href="/login" className="rounded-full border border-white/50 px-5 py-2.5">Ya tengo cuenta</Link>
            </div>
          </div>
        </section>

        <Section id="estudio" title="Estudio de marca" cards={STUDIO_CARDS} more="Diseñar mi marca" />
        <Section id="clubes" title="Para clubes" cards={CLUB_CARDS} more="Registrar mi club" />
      </main>

      {/* pie */}
      <footer className="mx-auto max-w-[1440px] px-4 pb-8">
        <div className="grid gap-6 border-b border-black/10 py-8 sm:grid-cols-3">
          {FOOT.map((col, k) => (
            <ul key={k} className="space-y-5 text-[15px] font-semibold sm:border-l sm:border-black/10 sm:pl-5 sm:first:border-0 sm:first:pl-0">
              {col.map(([label, href]) => <li key={label}><Link href={href} className="hover:underline">{label}</Link></li>)}
            </ul>
          ))}
        </div>
        <div className="flex flex-col items-center justify-between gap-4 pt-6 text-xs sm:flex-row">
          <span className="rounded-md border border-black/15 bg-white px-3 py-2">Español</span>
          <span className="opacity-70">© {new Date().getFullYear()} VeoSoccer</span>
          <Wordmark />
        </div>
      </footer>
    </div>
  );
}
