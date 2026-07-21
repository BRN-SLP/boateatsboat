import Link from "next/link";
import { Anchor, Flame, Shield } from "lucide-react";
import { StarConnect } from "@/components/star-connect";

export default function AboutPage() {
  return (
    <main className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-gray-900">
      <div className="relative aspect-video h-full max-h-screen w-full overflow-hidden bg-[#A8D8EA] shadow-2xl">
        {/* UI Layer */}
        <div className="absolute inset-0 flex h-full w-full flex-col p-6">
          {/* Top: Nav + Title */}
          <div className="flex items-start justify-between">
            <nav className="flex w-28 flex-col gap-2 pl-2 pt-2">
              <Link href="/" className="sticker-btn doodle-border doodle-shadow -rotate-6 origin-bottom-right bg-white px-3 py-1.5 text-center font-marker text-lg uppercase tracking-wider">
                Home
              </Link>
              <Link href="/play" className="sticker-btn doodle-border doodle-shadow rotate-3 origin-center bg-white px-3 py-1.5 text-center font-marker text-lg uppercase tracking-wider">
                Arena
              </Link>
              <Link href="/about" className="sticker-btn doodle-border doodle-shadow -rotate-2 origin-top-left bg-[#d33a30] px-3 py-1.5 text-center font-marker text-lg uppercase tracking-wider text-white">
                About
              </Link>
            </nav>

            <header className="flex flex-1 flex-col items-center justify-start pt-2">
              <h1 className="text-center font-creepster text-4xl leading-tight tracking-widest text-[#1a1a1a] md:text-5xl lg:text-6xl">
                HOW THE TUB WORKS
              </h1>
              <p className="mt-1 font-marker text-sm text-[#1a1a1a]/70">
                Plastic ships. Rubber ducks. Real on-chain duels.
              </p>
            </header>

            <div className="flex w-28 justify-end pt-2">
              <StarConnect size="sm" />
            </div>
          </div>

          {/* Scrollable content area */}
          <div className="doodle-border doodle-shadow mt-4 flex-1 overflow-y-auto bg-[#F9F7F2] p-6">
            {/* Steps */}
            <div className="grid gap-4 md:grid-cols-3">
              <Step
                icon={<Anchor className="h-5 w-5" />}
                title="Place your fleet"
                body="Carrier, armored Battleship, Cruiser, and a stealth Submarine. Your layout is committed as a Merkle root — opponents cannot peek."
              />
              <Step
                icon={<Flame className="h-5 w-5" />}
                title="Fire and prove"
                body="Take turns firing. The defender answers each shot with a cryptographic proof of hit or miss. Lying is impossible."
              />
              <Step
                icon={<Shield className="h-5 w-5" />}
                title="Win or drain"
                body="Sink every enemy cell. Battleship armor absorbs one hit; submarines hide in silence. Last fleet afloat wins."
              />
            </div>

            {/* Fleet spec */}
            <h2 className="mb-3 mt-6 font-marker text-xl uppercase text-[#1a1a1a]">Your Fleet</h2>
            <div className="doodle-border overflow-hidden bg-white">
              <table className="w-full text-left">
                <thead className="bg-[#1a1a1a]/5">
                  <tr>
                    <th className="px-3 py-2 font-marker text-xs uppercase text-[#1a1a1a]">Ship</th>
                    <th className="px-3 py-2 font-marker text-xs uppercase text-[#1a1a1a]">Cells</th>
                    <th className="px-3 py-2 font-marker text-xs uppercase text-[#1a1a1a]">HP</th>
                    <th className="px-3 py-2 font-marker text-xs uppercase text-[#1a1a1a]">Special</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a1a1a]/10">
                  <tr>
                    <td className="px-3 py-2 font-marker text-sm">Carrier</td>
                    <td className="px-3 py-2 text-sm">5</td>
                    <td className="px-3 py-2 text-sm">1</td>
                    <td className="px-3 py-2 text-sm text-[#1a1a1a]/50">—</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-marker text-sm">Battleship</td>
                    <td className="px-3 py-2 text-sm">4</td>
                    <td className="px-3 py-2 text-sm">2 (armor)</td>
                    <td className="px-3 py-2 text-sm text-[#1a1a1a]/50">Survives first hit</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-marker text-sm">Cruiser</td>
                    <td className="px-3 py-2 text-sm">3</td>
                    <td className="px-3 py-2 text-sm">1</td>
                    <td className="px-3 py-2 text-sm text-[#1a1a1a]/50">—</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-marker text-sm">Submarine</td>
                    <td className="px-3 py-2 text-sm">3</td>
                    <td className="px-3 py-2 text-sm">1</td>
                    <td className="px-3 py-2 text-sm text-[#1a1a1a]/50">Stealth (hidden until hit)</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Tech strip */}
            <div className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-1 font-marker text-xs uppercase tracking-wider text-[#1a1a1a]/50">
              <span>Celo</span>
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
        </div>
      </div>
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
    <div className="doodle-border flex flex-col items-start gap-2 bg-white p-4">
      <div className="flex items-center gap-2">
        <div className="rounded-full border-2 border-[#1a1a1a] bg-[#DF4949] p-2 text-white">
          {icon}
        </div>
        <h3 className="font-marker text-base uppercase text-[#1a1a1a]">{title}</h3>
      </div>
      <p className="text-xs leading-relaxed text-[#1a1a1a]/70">{body}</p>
    </div>
  );
}
