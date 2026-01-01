import Link from "next/link";
import { ArrowRight, Crown, Eye, Target, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const quickSteps = [
  {
    title: "Bid the contract",
    description: "Call 16-29 points. Trump stays hidden until it breaks.",
    icon: Target,
  },
  {
    title: "Reveal on the break",
    description: "Trump flips when a player can’t follow suit.",
    icon: Eye,
  },
  {
    title: "Secure the last trick",
    description: "The final trick is worth the 29th point.",
    icon: Trophy,
  },
];

const tableSeats = [
  { label: "North", className: "top-6 left-1/2 -translate-x-1/2" },
  { label: "West", className: "left-6 top-1/2 -translate-y-1/2" },
  { label: "East", className: "right-6 top-1/2 -translate-y-1/2" },
  { label: "You", className: "bottom-6 left-1/2 -translate-x-1/2", highlight: true },
];

const StatPill = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
    <p className="text-[11px] uppercase tracking-[0.35em] text-emerald-100/60">{label}</p>
    <p className="text-sm font-semibold text-emerald-50">{value}</p>
  </div>
);

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0b1511] text-emerald-50">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.18),_transparent_55%),radial-gradient(circle_at_85%_15%,_rgba(14,116,144,0.16),_transparent_45%),linear-gradient(160deg,_rgba(8,16,12,1),_rgba(7,15,11,1))]" />
      <div className="pointer-events-none absolute inset-0 opacity-40 mix-blend-screen [background-image:radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.12),transparent_40%),radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.08),transparent_45%)]" />

      <header className="relative mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-6 px-6 pt-8">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
            <span className="text-lg font-semibold text-emerald-50">29</span>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.45em] text-emerald-100/70">TwentyNine</p>
            <p className="text-sm text-emerald-100/60">Bengali trick-taking table</p>
          </div>
        </div>
        <nav className="hidden items-center gap-6 text-sm text-emerald-100/60 md:flex">
          <a href="#how" className="transition hover:text-emerald-100">
            How it plays
          </a>
          <a href="#table" className="transition hover:text-emerald-100">
            The table
          </a>
          <a href="#rules" className="transition hover:text-emerald-100">
            Rules
          </a>
        </nav>
        <Button asChild className="bg-[#f2c879] text-[#2b1c07] hover:bg-[#f8d690]">
          <Link href="/game">
            Play solo <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </header>

      <main className="relative mx-auto grid w-full max-w-6xl gap-12 px-6 pb-16 pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <section className="space-y-6">
          <Badge className="w-fit border border-white/15 bg-white/5 text-emerald-50">Solo table is live</Badge>
          <h1 className="font-serif text-4xl leading-tight text-emerald-50 md:text-6xl">
            Pull up a chair. Play Twenty-Nine in minutes.
          </h1>
          <p className="text-base leading-relaxed text-emerald-100/70 md:text-lg">
            A focused solo table with clear turn cues, guided bidding, and the classic 29 scoring. No confusion about
            what to do next—just the cards that matter.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg" className="bg-[#f2c879] text-[#2b1c07] hover:bg-[#f8d690]">
              <Link href="/game">
                Start a solo table <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-white/20 bg-transparent text-emerald-50 hover:bg-white/10"
            >
              <a href="#rules">Learn the rules</a>
            </Button>
          </div>
          <div className="flex flex-wrap gap-3">
            <StatPill label="Deck" value="32 cards" />
            <StatPill label="Tricks" value="8 per hand" />
            <StatPill label="Points" value="29 total" />
          </div>
        </section>

        <section id="table" className="relative">
          <div className="absolute inset-0 -rotate-2 rounded-[40px] border border-white/10 bg-white/5" />
          <div className="relative overflow-hidden rounded-[40px] border border-white/15 bg-[#0f2018] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(34,197,94,0.2),_transparent_55%)]" />
            <div className="absolute inset-6 rounded-[32px] border border-white/10" />
            <div className="absolute inset-6 rounded-[32px] border border-white/5 [background-image:repeating-linear-gradient(120deg,rgba(255,255,255,0.05)_0,rgba(255,255,255,0.05)_2px,transparent_2px,transparent_8px)]" />

            <div className="relative space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                    <Crown className="h-5 w-5 text-[#f2c879]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-50">Open Table</p>
                    <p className="text-xs text-emerald-100/60">Solo · Deterministic bots</p>
                  </div>
                </div>
                <Badge className="border border-white/10 bg-white/5 text-emerald-50">Round 1</Badge>
              </div>

              <div className="relative flex aspect-square items-center justify-center rounded-[32px] border border-white/10 bg-[#10251c]">
                <div className="absolute inset-10 rounded-full border border-white/10" />
                {tableSeats.map((seat) => (
                  <div
                    key={seat.label}
                    className={cn(
                      "absolute rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs uppercase tracking-[0.2em]",
                      seat.highlight ? "text-[#f2c879]" : "text-emerald-100/70",
                      seat.className
                    )}
                  >
                    {seat.label}
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "J♠", highlight: true },
                    { label: "9♠" },
                    { label: "Q♠" },
                    { label: "A♠", highlight: true },
                  ].map((card) => (
                    <div
                      key={card.label}
                      className={cn(
                        "flex h-14 w-10 items-center justify-center rounded-lg border text-xs font-semibold",
                        card.highlight
                          ? "border-[#f2c879] bg-[#f2c879] text-[#2b1c07]"
                          : "border-white/10 bg-white/5 text-emerald-100/80"
                      )}
                    >
                      {card.label}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-emerald-100/60">Your hand</p>
                  <p className="text-sm text-emerald-50">Play highlighted cards to follow suit.</p>
                </div>
                <div className="flex gap-2">
                  {[{ label: "J♣", active: true }, { label: "9♥" }, { label: "10♦", active: true }].map((card) => (
                    <div
                      key={card.label}
                      className={cn(
                        "flex h-11 w-8 items-center justify-center rounded-lg border text-xs font-semibold",
                        card.active
                          ? "border-[#f2c879] bg-[#f2c879] text-[#2b1c07]"
                          : "border-white/10 bg-white/5 text-emerald-100/70"
                      )}
                    >
                      {card.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <section id="how" className="relative mx-auto w-full max-w-6xl px-6 pb-16">
        <div className="grid gap-6 md:grid-cols-3">
          {quickSteps.map((step) => (
            <div
              key={step.title}
              className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_18px_40px_rgba(0,0,0,0.35)]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                <step.icon className="h-5 w-5 text-[#f2c879]" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-emerald-50">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-emerald-100/70">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="rules" className="relative mx-auto w-full max-w-6xl px-6 pb-24">
        <div className="rounded-3xl border border-white/10 bg-black/30 p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-emerald-100/60">Rules snapshot</p>
              <h2 className="mt-2 font-serif text-2xl text-emerald-50">Classic 29 scoring at a glance</h2>
            </div>
            <Badge className="border border-white/10 bg-white/5 text-emerald-50">J, 9, A, 10 score points</Badge>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {[
              "32-card deck: 7 through A in each suit",
              "Rank order: J > 9 > A > 10 > K > Q > 8 > 7",
              "Trump chosen by bidder, revealed when suit breaks",
              "Last trick bonus adds the 29th point",
            ].map((rule) => (
              <div key={rule} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <span className="text-sm text-emerald-100/80">{rule}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
