import Link from "next/link";

export default function Home() {
  return (
    <main className="relative flex h-screen w-screen overflow-hidden bg-gray-900">
      {/* 16:9 Game Container */}
      <div className="relative aspect-video w-full overflow-hidden bg-white shadow-2xl">
        {/* Background Image */}
        <div className="absolute inset-0 h-full w-full">
          <img
            src="/hero.webp"
            alt="Bathtub Arena Background"
            className="h-full w-full object-cover object-center"
            fetchPriority="high"
          />
        </div>

        {/* UI Overlay Layer */}
        <div className="pointer-events-none absolute inset-0 flex h-full w-full flex-col justify-between p-6">
          {/* Top Section: Navigation, Title, Connect Wallet */}
          <div className="pointer-events-auto flex items-start justify-between">
            {/* Left: Navigation Stickers */}
            <nav
              aria-label="Main Navigation"
              className="relative z-10 flex w-32 flex-col gap-2 pl-4 pt-4"
            >
              <Link
                href="/"
                className="sticker-btn doodle-border doodle-shadow -rotate-6 origin-bottom-right bg-white px-4 py-2 font-marker text-xl uppercase tracking-wider"
              >
                Home
              </Link>
              <Link
                href="/play"
                className="sticker-btn doodle-border doodle-shadow rotate-3 origin-center bg-white px-4 py-2 font-marker text-xl uppercase tracking-wider"
              >
                Arena
              </Link>
              <Link
                href="/about"
                className="sticker-btn doodle-border doodle-shadow -rotate-2 origin-top-left bg-white px-4 py-2 font-marker text-xl uppercase tracking-wider"
              >
                About
              </Link>
            </nav>

            {/* Center: Header Title */}
            <header className="relative z-0 flex flex-1 flex-col items-center justify-start pt-2">
              <h1 className="text-center font-creepster text-5xl leading-tight tracking-widest text-white text-outline-black drop-shadow-md md:text-6xl lg:text-7xl">
                <span className="block">BATHTUB ARENA:</span>
                <span className="mt-1 block">BOATEATSBOAT</span>
              </h1>
            </header>

            {/* Right: Connect Wallet Star */}
            <div className="relative z-10 pr-4 pt-2">
              <button
                aria-label="Connect Wallet"
                className="star-btn group relative flex h-40 w-40 rotate-[15deg] items-center justify-center"
              >
                {/* Hand-drawn irregular star SVG */}
                <svg
                  className="absolute inset-0 h-full w-full fill-yellow-400 stroke-[#1a1a1a] stroke-[3px] drop-shadow-[4px_4px_0_rgba(26,26,26,1)]"
                  viewBox="0 0 100 100"
                >
                  <path
                    d="M50 5 L62 38 L95 40 L70 62 L78 95 L50 78 L22 95 L30 62 L5 40 L38 38 Z"
                    stroke-linejoin="round"
                  />
                </svg>
                <span className="relative z-10 block w-16 -rotate-[15deg] text-center font-marker text-xs font-bold uppercase leading-tight text-black">
                  Connect
                  <br />
                  Wallet
                </span>
              </button>
            </div>
          </div>

          {/* Bottom Section: Play Button */}
          <div className="pointer-events-auto flex w-full justify-center pb-8">
            <Link href="/play">
              <button className="play-btn doodle-shadow-large group relative overflow-hidden rounded-[2rem] border-4 border-[#1a1a1a] bg-[#d33a30] px-12 py-4 font-marker text-4xl uppercase tracking-wider text-white md:text-5xl">
                {/* Subtle highlight overlay for 3D effect */}
                <div className="absolute left-0 top-0 h-1/3 w-full rounded-t-[1.5rem] bg-white opacity-20"></div>
                <span className="relative z-10 tracking-wider">PLAY NOW</span>
              </button>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
