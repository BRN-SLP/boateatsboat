import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Flame, Anchor, Shield, Waves, Play } from "lucide-react";

export default function Home() {
  return (
    <main className="flex-1">
      {/* Hero with the user-designed Bathtub Arena artwork as backdrop */}
      <section className="relative min-h-[100svh] overflow-hidden">
        {/* Artwork: fills the viewport, slight scale to cover widescreens */}
        <img
          src="/hero.webp"
          alt="Bathtub Arena: two toy fleets face off across a bubbly bathtub"
          className="absolute inset-0 h-full w-full object-cover"
          fetchPriority="high"
          // loading eager because it is the first paint
        />

        {/* Top scrim so the sticky navbar reads cleanly over the busy art */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/55 to-transparent"
        />
        {/* Bottom scrim so the CTA + meta strip read cleanly */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/70 via-black/25 to-transparent"
        />

        {/* Centered content column over the soap */}
        <div className="relative z-10 flex min-h-[100svh] flex-col items-center justify-center px-4 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/30 bg-black/35 px-3 py-1 text-sm font-medium text-amber-100 backdrop-blur-sm">
            <Flame className="h-4 w-4" />
            On-chain battleship. Bathtub edition.
          </div>

          {/* Mockup-style title: small kicker line over a big block wordmark */}
          <h1 className="mb-3 text-sm font-semibold uppercase tracking-[0.4em] text-white/90 drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)]">
            Bathtub Arena:
          </h1>
          <h2 className="mb-10 text-5xl font-black uppercase leading-[0.9] tracking-tight text-white drop-shadow-[0_4px_14px_rgba(0,0,0,0.75)] sm:text-7xl lg:text-8xl">
            Boat<span className="text-amber-300">Eats</span>Boat
          </h2>

          <p className="mb-10 max-w-xl text-base text-white/90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)] sm:text-lg">
            Plastic ships. Rubber ducks. Real on-chain duels. Commit your fleet with a
            Merkle root, fire shots, prove every hit. The AI agent is always ready to play.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row">
            <Link href="/play">
              <Button
                size="lg"
                className="group gap-2 rounded-full bg-amber-400 px-10 py-6 text-base font-bold uppercase tracking-wide text-slate-900 shadow-lg shadow-amber-500/30 transition hover:bg-amber-300 hover:shadow-amber-400/50"
              >
                <Play className="h-5 w-5 fill-current transition group-hover:scale-110" />
                Play Now
              </Button>
            </Link>
            <Link href="/leaderboard">
              <Button
                size="lg"
                variant="outline"
                className="rounded-full border-white/40 bg-white/10 px-8 py-6 text-base font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                Leaderboard
              </Button>
            </Link>
          </div>

          {/* Tiny duck audience wobble (kept from earlier draft) */}
          <div
            className="mt-12 flex select-none justify-center gap-8 text-3xl"
            aria-hidden
          >
            <DuckWobble delay={0} />
            <DuckWobble delay={0.4} />
            <DuckWobble delay={0.8} />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-16 border-t border-slate-100 bg-amber-50/40 py-16">
        <div className="container mx-auto max-w-5xl px-4">
          <h2 className="mb-12 text-center text-2xl font-bold text-slate-800">
            How the tub works
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            <Step
              icon={<Anchor className="h-6 w-6" />}
              title="Place your fleet"
              body="Carrier, armored Battleship, Cruiser, and a stealth Submarine. Your layout is committed as a Merkle root -- opponents cannot peek."
            />
            <Step
              icon={<Flame className="h-6 w-6" />}
              title="Fire and prove"
              body="Take turns firing. The defender answers each shot with a cryptographic proof of hit or miss. Lying is impossible."
            />
            <Step
              icon={<Shield className="h-6 w-6" />}
              title="Win or drain"
              body="Sink every enemy cell. Battleship armor absorbs one hit; submarines hide in silence. Last fleet afloat wins."
            />
          </div>
        </div>
      </section>

      {/* Tech strip */}
      <section className="border-t border-slate-100 bg-slate-50 py-12">
        <div className="container mx-auto max-w-5xl text-center">
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Waves className="h-4 w-4" /> Celo
            </span>
            <span>·</span>
            <span>UUPS upgradeable</span>
            <span>·</span>
            <span>Merkle proofs</span>
            <span>·</span>
            <span>MiniPay-ready</span>
            <span>·</span>
            <span>Open source</span>
          </div>
        </div>
      </section>
    </main>
  );
}

function Step({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-start gap-3 text-left">
      <div className="rounded-full bg-rose-100 p-3 text-rose-600">{icon}</div>
      <h3 className="font-semibold text-slate-800">{title}</h3>
      <p className="text-sm leading-relaxed text-slate-600">{body}</p>
    </div>
  );
}

function DuckWobble({ delay }: { delay: number }) {
  // CSS-only wobble; reduced-motion safe (animation disables on prefers-reduced-motion via globals).
  return (
    <span
      style={{
        display: "inline-block",
        animation: `wobble 2.4s ease-in-out ${delay}s infinite`,
      }}
    >
      🦆
    </span>
  );
}
