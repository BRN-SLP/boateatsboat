"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAccount } from "wagmi";
import { parseUnits } from "viem";
import { useCreateDuel, useJoinDuel } from "@/hooks/use-wager";
import { StarConnect } from "@/components/star-connect";
import { cn } from "@/lib/utils";

// Fixed wager presets in cUSD (18 decimals). Custom lets the player type any.
const WAGER_PRESETS = [
  { label: "0.5", value: "0.5" },
  { label: "1", value: "1" },
  { label: "5", value: "5" },
] as const;

type Mode = "friendly" | "money";

export default function PlayPage() {
  const router = useRouter();
  const { address } = useAccount();
  const { create: createDuel, pending: createPending, error: createError } = useCreateDuel();
  const { join: joinDuel, pending: joinPending, error: joinError } = useJoinDuel();

  const [mode, setMode] = useState<Mode>("friendly");
  const [preset, setPreset] = useState<string>("1");
  const [customWager, setCustomWager] = useState<string>("");
  const [useCustom, setUseCustom] = useState(false);
  const [joinId, setJoinId] = useState("");
  // In free mode: vs AI (bot auto-joins) or vs Friend (wait for a human by id).
  const [vsBot, setVsBot] = useState(true);
  // When a vs-Friend duel is created we show its shareable code before navigating.
  const [friendCode, setFriendCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const wager = (() => {
    if (mode === "friendly") return 0n;
    const amt = useCustom ? customWager : preset;
    if (!amt || isNaN(Number(amt)) || Number(amt) <= 0) return 0n;
    try {
      return parseUnits(amt, 18);
    } catch {
      return 0n;
    }
  })();

  const onCreate = async () => {
    const id = await createDuel(wager, mode === "friendly" ? vsBot : false);
    if (id === null) return;
    if (mode === "friendly" && !vsBot) {
      // vs Friend: reveal the shareable game code, don't navigate yet.
      setFriendCode(id.toString());
      setCopied(false);
      return;
    }
    router.push(`/game/${id}`);
  };

  const copyCode = async () => {
    if (!friendCode) return;
    try {
      await navigator.clipboard.writeText(friendCode);
      setCopied(true);
    } catch {
      // clipboard may be unavailable; ignore
    }
  };

  const openFriendGame = () => {
    if (friendCode) router.push(`/game/${friendCode}`);
  };

  const onJoin = async () => {
    if (!joinId) return;
    const ok = await joinDuel(BigInt(joinId));
    if (ok) router.push(`/game/${BigInt(joinId)}`);
  };

  const busy = createPending || joinPending;

  return (
    <main className="relative flex h-[100dvh] w-screen items-center justify-center overflow-hidden bg-gray-900">
      <div className="relative aspect-video h-full max-h-[100dvh] w-full overflow-hidden bg-[#A8D8EA] shadow-2xl">
        {/* UI Layer */}
        <div className="absolute inset-0 flex h-full w-full flex-col overflow-y-auto p-6">
          {/* Top: Nav + Title */}
          <div className="flex items-start justify-between">
            <nav className="flex w-28 flex-col gap-2 pl-2 pt-2">
              <Link href="/" className="sticker-btn doodle-border doodle-shadow -rotate-6 origin-bottom-right bg-white px-3 py-1.5 text-center font-marker text-lg uppercase tracking-wider">
                Home
              </Link>
              <Link href="/play" className="sticker-btn doodle-border doodle-shadow rotate-3 origin-center bg-[#d33a30] px-3 py-1.5 text-center font-marker text-lg uppercase tracking-wider text-white">
                Arena
              </Link>
              <Link href="/about" className="sticker-btn doodle-border doodle-shadow -rotate-2 origin-top-left bg-white px-3 py-1.5 text-center font-marker text-lg uppercase tracking-wider">
                About
              </Link>
            </nav>

            <header className="flex flex-1 flex-col items-center justify-start pt-2">
              <h1 className="text-center font-creepster text-4xl leading-tight tracking-widest text-[#1a1a1a] md:text-5xl lg:text-6xl">
                PICK YOUR TUB
              </h1>
              <p className="mt-1 font-marker text-sm text-[#1a1a1a]/70">
                Friendly or for keeps. Every shot is a real Celo transaction.
              </p>
            </header>

            <div className="flex w-28 justify-end pt-2">
              <StarConnect size="sm" />
            </div>
          </div>

          {/* Center: Mode selection */}
          <div className="flex flex-1 items-center justify-center">
            <div className="grid w-full max-w-3xl gap-5 sm:grid-cols-2">
              {/* Friendly */}
              <ModeCard
                title="Free duel"
                emoji="🤖"
                active={mode === "friendly"}
                onClick={() => setMode("friendly")}
                rotate="-rotate-2"
              >
                <p className="text-xs leading-relaxed text-[#1a1a1a]/60">
                  No stakes. Real on-chain shots, real Merkle proofs.
                </p>
                {/* Opponent toggle: AI bot (auto-join) vs Friend (share code). */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={mode !== "friendly"}
                    onClick={() => setVsBot(true)}
                    className={cn(
                      "doodle-border flex-1 rounded-lg px-2 py-1.5 font-marker text-xs uppercase",
                      mode === "friendly" && vsBot ? "bg-[#1a1a1a] text-white" : "bg-white text-[#1a1a1a]"
                    )}
                  >
                    🤖 vs AI
                  </button>
                  <button
                    type="button"
                    disabled={mode !== "friendly"}
                    onClick={() => setVsBot(false)}
                    className={cn(
                      "doodle-border flex-1 rounded-lg px-2 py-1.5 font-marker text-xs uppercase",
                      mode === "friendly" && !vsBot ? "bg-[#1a1a1a] text-white" : "bg-white text-[#1a1a1a]"
                    )}
                  >
                    🤝 vs Friend
                  </button>
                </div>
                {mode === "friendly" && !vsBot && friendCode ? (
                  // vs Friend: show the shareable game code with copy + open.
                  <div className="flex flex-col gap-2">
                    <p className="text-center font-marker text-[10px] uppercase text-[#1a1a1a]/60">
                      Share this game code with your friend:
                    </p>
                    <div className="doodle-border flex items-center gap-1 rounded-md bg-white px-2 py-1">
                      <code className="flex-1 truncate font-mono text-sm text-[#1a1a1a]">{friendCode}</code>
                      <button
                        type="button"
                        onClick={copyCode}
                        className="rounded bg-[#257ABB] px-2 py-0.5 font-marker text-[10px] uppercase text-white"
                      >
                        {copied ? "✓ Copied" : "Copy"}
                      </button>
                    </div>
                    <button
                      onClick={openFriendGame}
                      className="play-btn doodle-shadow-large rounded-2xl border-[3px] border-[#1a1a1a] bg-[#257ABB] px-6 py-2 font-marker text-base uppercase tracking-wider text-white"
                    >
                      Open my duel
                    </button>
                  </div>
                ) : (
                  <button
                    disabled={!address || busy || mode !== "friendly"}
                    onClick={onCreate}
                    className="play-btn doodle-shadow-large mt-auto rounded-2xl border-[3px] border-[#1a1a1a] bg-[#257ABB] px-6 py-3 font-marker text-xl uppercase tracking-wider text-white disabled:opacity-40"
                  >
                    {createPending && mode === "friendly"
                      ? "Deploying..."
                      : vsBot
                      ? "Fight the AI"
                      : "Create & get code"}
                  </button>
                )}
              </ModeCard>

              {/* Money */}
              <ModeCard
                title="Duel for keeps"
                emoji="💰"
                active={mode === "money"}
                onClick={() => setMode("money")}
                rotate="rotate-2"
              >
                <p className="text-xs leading-relaxed text-[#1a1a1a]/60">
                  Stake cUSD. Winner takes both stakes. Forfeit if a player
                  stalls past 24h. You wait for a real opponent.
                </p>
                {/* Preset amounts */}
                <div className="flex flex-wrap gap-2">
                  {WAGER_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      disabled={mode !== "money"}
                      onClick={() => { setPreset(p.value); setUseCustom(false); }}
                      className={cn(
                        "doodle-border rounded-lg px-3 py-1.5 font-marker text-sm uppercase",
                        mode === "money" && !useCustom && preset === p.value
                          ? "bg-[#1a1a1a] text-white"
                          : "bg-white text-[#1a1a1a]"
                      )}
                    >
                      {p.label} cUSD
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={mode !== "money"}
                    onClick={() => setUseCustom(true)}
                    className={cn(
                      "doodle-border rounded-lg px-3 py-1.5 font-marker text-sm uppercase",
                      mode === "money" && useCustom ? "bg-[#1a1a1a] text-white" : "bg-white text-[#1a1a1a]"
                    )}
                  >
                    Custom
                  </button>
                </div>
                {useCustom && mode === "money" && (
                  <input
                    type="text"
                    inputMode="decimal"
                    value={customWager}
                    onChange={(e) => setCustomWager(e.target.value)}
                    placeholder="e.g. 2.5"
                    className="doodle-border rounded-md bg-white px-3 py-2 font-marker text-lg text-[#1a1a1a] placeholder:text-[#1a1a1a]/30"
                  />
                )}
                <button
                  disabled={!address || busy || mode !== "money" || (mode === "money" && wager === 0n)}
                  onClick={onCreate}
                  className="play-btn doodle-shadow-large mt-auto rounded-2xl border-[3px] border-[#1a1a1a] bg-[#d33a30] px-6 py-3 font-marker text-xl uppercase tracking-wider text-white disabled:opacity-40"
                >
                  {createPending && mode === "money"
                    ? "Deploying..."
                    : wager > 0n
                    ? `Stake & create`
                    : "Enter an amount"}
                </button>
              </ModeCard>
            </div>
          </div>

          {/* Join by id */}
          <div className="flex shrink-0 items-center justify-center gap-2 pb-2">
            <span className="font-marker text-xs uppercase tracking-wider text-[#1a1a1a]/60">
              Join a duel by id:
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={joinId}
              onChange={(e) => setJoinId(e.target.value)}
              placeholder="e.g. 7"
              className="doodle-border w-24 rounded-md bg-white px-2 py-1 font-marker text-sm text-[#1a1a1a] placeholder:text-[#1a1a1a]/30"
            />
            <button
              disabled={!address || busy || !joinId}
              onClick={onJoin}
              className="doodle-border doodle-shadow rounded-lg bg-white px-3 py-1 font-marker text-sm uppercase text-[#1a1a1a] disabled:opacity-40"
            >
              {joinPending ? "Joining..." : "Join"}
            </button>
          </div>

          {/* Error toast */}
          {(createError || joinError) && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
              <div className="doodle-border doodle-shadow rotate-1 bg-[#fff3cd] px-4 py-2 font-marker text-xs uppercase text-[#856404]">
                {createError || joinError}
              </div>
            </div>
          )}

          {/* Wallet warning */}
          {!address && (
            <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="doodle-border doodle-shadow rotate-2 bg-[#fff3cd] px-6 py-3 font-marker text-sm uppercase text-[#856404]">
                Connect your wallet to play
              </div>
            </div>
          )}

          {/* Bottom caption */}
          <div className="flex shrink-0 justify-center pb-1">
            <p className="font-marker text-[10px] uppercase tracking-wider text-[#1a1a1a]/50">
              Each shot is on-chain · Boat eats boat · Tournaments coming soon
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function ModeCard({
  title,
  emoji,
  active,
  onClick,
  rotate,
  children,
}: {
  title: string;
  emoji: string;
  active: boolean;
  onClick: () => void;
  rotate: string;
  children: React.ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "sticker-btn doodle-border doodle-shadow flex cursor-pointer flex-col gap-3 bg-[#F9F7F2] p-5 transition-all",
        rotate,
        active ? "ring-2 ring-[#1a1a1a]" : "opacity-70 hover:opacity-100"
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-2xl">{emoji}</span>
        <h2 className="font-marker text-xl uppercase text-[#1a1a1a] md:text-2xl">{title}</h2>
      </div>
      {children}
    </div>
  );
}
