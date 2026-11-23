import Link from "next/link";
import Image from "next/image";

type AppHeaderProps = {
  active?: "landing" | "scan" | "processing" | "results";
};

export function AppHeader({ active }: AppHeaderProps) {
  const links = [
    { href: "/", label: "Home", key: "landing" },
    { href: "/scan", label: "Scan", key: "scan" },
    { href: "/results/DVj0HP6CQOP", label: "Demo", key: "results" }
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-cyan/10 bg-black/55 px-4 py-3 backdrop-blur-2xl md:px-8">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4">
        <Link href="/" className="group flex min-w-0 items-center gap-3" aria-label="Grey Matter home">
          <span className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] shadow-[0_0_26px_rgba(0,242,255,0.12)] transition group-hover:border-cyan/35 group-hover:shadow-[0_0_32px_rgba(0,242,255,0.22)] md:h-16 md:w-16">
            <Image
              src="/greymatter-logo.png"
              alt="Grey Matter"
              width={128}
              height={128}
              priority
              className="h-full w-full object-contain p-1.5"
            />
          </span>
          <span className="hidden min-w-0 md:block">
            <span className="block font-display text-sm font-black uppercase tracking-[0.18em] text-white">Grey Matter</span>
            <span className="mt-1 block font-display text-[10px] uppercase tracking-[0.2em] text-cyan/60">Neural reel diagnostics</span>
          </span>
        </Link>

        <nav className="hidden items-center rounded-full border border-white/10 bg-white/[0.045] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_50px_rgba(0,0,0,0.28)] md:flex">
          {links.map((link) => {
            const isActive = active === link.key;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-4 py-2 font-display text-[11px] font-bold uppercase tracking-[0.16em] transition ${
                  isActive
                    ? "bg-cyan text-black shadow-[0_0_24px_rgba(0,242,255,0.32)]"
                    : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <Link
          href="/scan"
          className="rounded-full border border-cyan/40 bg-cyan px-4 py-2.5 font-display text-[11px] font-black uppercase tracking-[0.16em] text-[#002022] shadow-[0_0_26px_rgba(0,242,255,0.26)] transition hover:shadow-[0_0_36px_rgba(0,242,255,0.42)] md:px-5"
        >
          Try Now
        </Link>
      </div>
    </header>
  );
}
