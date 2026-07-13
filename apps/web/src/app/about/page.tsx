import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Anchor, Flame, Shield, Waves, ArrowLeft } from "lucide-react";

export default function AboutPage() {
  return (
    <main className="flex-1 bg-[#A8D8EA]">
      <section className="container mx-auto max-w-3xl px-4 py-16">
        <Link href="/">
          <Button variant="ghost" className="mb-8 gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Arena
          </Button>
        </Link>

        <h1 className="mb-2 text-4xl font-black uppercase tracking-tight text-black">
          How the Tub Works
        </h1>
        <p className="mb-12 text-lg text-black/70">
          Plastic ships. Rubber ducks. Real on-chain duels.
        </p>

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

        {/* Fleet spec */}
        <h2 className="mb-6 mt-16 text-2xl font-bold text-black">Your Fleet</h2>
        <div className="overflow-hidden rounded-xl border-2 border-black bg-[#F9F7F2]">
          <table className="w-full text-left">
            <thead className="bg-black/5">
              <tr>
                <th className="px-4 py-3 font-bold uppercase text-sm text-black">Ship</th>
                <th className="px-4 py-3 font-bold uppercase text-sm text-black">Cells</th>
                <th className="px-4 py-3 font-bold uppercase text-sm text-black">HP</th>
                <th className="px-4 py-3 font-bold uppercase text-sm text-black">Special</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              <tr>
                <td className="px-4 py-3 font-medium">Carrier</td>
                <td className="px-4 py-3">5</td>
                <td className="px-4 py-3">1</td>
                <td className="px-4 py-3 text-black/60">--</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium">Battleship</td>
                <td className="px-4 py-3">4</td>
                <td className="px-4 py-3">2 (armor)</td>
                <td className="px-4 py-3 text-black/60">Survives first hit</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium">Cruiser</td>
                <td className="px-4 py-3">3</td>
                <td className="px-4 py-3">1</td>
                <td className="px-4 py-3 text-black/60">--</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium">Submarine</td>
                <td className="px-4 py-3">3</td>
                <td className="px-4 py-3">1</td>
                <td className="px-4 py-3 text-black/60">Stealth (hidden until hit)</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Tech strip */}
        <div className="mt-12 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-black/60">
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
    <div className="flex flex-col items-start gap-3 rounded-xl border-2 border-black bg-[#F9F7F2] p-5 text-left">
      <div className="rounded-full border-2 border-black bg-[#DF4949] p-3 text-white">
        {icon}
      </div>
      <h3 className="font-bold text-black">{title}</h3>
      <p className="text-sm leading-relaxed text-black/70">{body}</p>
    </div>
  );
}
