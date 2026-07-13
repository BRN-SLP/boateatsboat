import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Flame, Play } from "lucide-react";

export default function Home() {
  return (
    <main className="flex-1 overflow-hidden">
      {/* Full-screen hero: no scroll, everything fits in viewport */}
      <section className="relative h-[100svh] w-full overflow-hidden">
        {/* Artwork: full-bleed background */}
        <img
          src="/hero.webp"
          alt="Bathtub Arena: two toy fleets face off across a bubbly bathtub"
          className="absolute inset-0 h-full w-full object-cover"
          fetchPriority="high"
        />

        {/* Top scrim for navbar legibility */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/50 to-transparent"
        />
        {/* Bottom scrim for CTA legibility */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/60 via-black/20 to-transparent"
        />

        {/* Centered content — fits in one screen, no scroll */}
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-4 text-center">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border-2 border-black/60 bg-[#F9F7F2]/90 px-4 py-1.5 text-sm font-bold uppercase tracking-wider text-black shadow-sm">
            <Flame className="h-4 w-4 text-[#DF4949]" />
            On-chain battleship. Bathtub edition.
          </div>

          {/* Title: kicker + wordmark */}
          <h1 className="mb-2 text-xs font-bold uppercase tracking-[0.5em] text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)] sm:text-sm">
            Bathtub Arena:
          </h1>
          <h2 className="mb-8 text-5xl font-black uppercase leading-[0.9] tracking-tight text-white drop-shadow-[0_4px_14px_rgba(0,0,0,0.8)] sm:text-7xl lg:text-8xl">
            BoatEatsBoat
          </h2>

          {/* Tagline */}
          <p className="mb-8 max-w-lg text-sm text-white/90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)] sm:text-base">
            Plastic ships. Rubber ducks. Real on-chain duels. Commit your fleet
            with a Merkle root, fire shots, prove every hit.
          </p>

          {/* CTA: firebrick red pill (per DESIGN.md) */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/play">
              <Button
                size="lg"
                className="group gap-2 rounded-full border-2 border-black bg-[#DF4949] px-10 py-6 text-base font-bold uppercase tracking-wide text-white shadow-[0_4px_0_0_#8B0000] transition hover:bg-[#C0392B] active:translate-y-1 active:shadow-[0_1px_0_0_#8B0000]"
              >
                <Play className="h-5 w-5 fill-current transition group-hover:scale-110" />
                Play Now
              </Button>
            </Link>
            <Link href="/leaderboard">
              <Button
                size="lg"
                variant="outline"
                className="rounded-full border-2 border-white/50 bg-white/10 px-8 py-6 text-base font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                Leaderboard
              </Button>
            </Link>
          </div>

          {/* Footer text */}
          <p className="mt-8 text-xs text-white/60 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            Powered by Celo. Merkle proofs. No cheating.
          </p>
        </div>
      </section>
    </main>
  );
}
