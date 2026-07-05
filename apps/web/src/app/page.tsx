import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Flame, Anchor, Shield, Waves } from "lucide-react";

export default function Home() {
  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="relative py-20 lg:py-32 overflow-hidden">
        {/* Soft bathtub-of-water gradient backdrop */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-sky-50 via-cream to-rose-50" />
        <div className="absolute inset-0 -z-10 opacity-30 [background:radial-gradient(circle_at_30%_20%,rgba(255,200,150,0.4),transparent_40%),radial-gradient(circle_at_70%_60%,rgba(150,200,255,0.4),transparent_40%)]" />

        <div className="container px-4 mx-auto max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-8 text-sm font-medium bg-rose-100 text-rose-700 rounded-full border border-rose-200">
            <Flame className="h-4 w-4" />
            On-chain battleship. Bathtub edition.
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 text-slate-800">
            Boat eats{" "}
            <span className="bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 bg-clip-text text-transparent">
              boat
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            Plastic ships. Rubber ducks. Real on-chain duels. Commit your fleet with a
            Merkle root, fire shots, and prove every hit. The AI agent is always ready to play.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <Link href="/play">
              <Button size="lg" className="px-8 py-3 text-base font-medium">
                Play a duel
              </Button>
            </Link>
            <Link href="/leaderboard">
              <Button size="lg" variant="outline" className="px-8 py-3 text-base font-medium">
                Leaderboard
              </Button>
            </Link>
          </div>

          {/* Tiny duck audience wobble */}
          <div className="flex justify-center gap-8 text-3xl select-none" aria-hidden>
            <DuckWobble delay={0} />
            <DuckWobble delay={0.4} />
            <DuckWobble delay={0.8} />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 border-t border-slate-100">
        <div className="container px-4 mx-auto max-w-5xl">
          <h2 className="text-2xl font-bold text-center text-slate-800 mb-12">
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
      <section className="py-12 bg-slate-50 border-t border-slate-100">
        <div className="container px-4 mx-auto max-w-5xl text-center">
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5"><Waves className="h-4 w-4" /> Celo</span>
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
      <p className="text-sm text-slate-600 leading-relaxed">{body}</p>
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
