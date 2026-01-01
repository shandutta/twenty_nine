import Link from "next/link"
import { ArrowRight, Crown, Sparkles, Target, Trophy } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const featureCards = [
  {
    title: "Strategic bidding",
    description: "Call the contract, hide the trump, and shape the tempo of the hand.",
    icon: Target,
  },
  {
    title: "Classic 29 rules",
    description: "J, 9, A, 10 lead the pack. Last trick bonus included.",
    icon: Trophy,
  },
  {
    title: "Deterministic bots",
    description: "Reliable opponents for practice today, multiplayer ambitions tomorrow.",
    icon: Sparkles,
  },
]

const QuickStat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-emerald-200/10 bg-emerald-950/40 px-4 py-3">
    <div className="text-[11px] uppercase tracking-[0.3em] text-emerald-200/70">{label}</div>
    <div className="text-lg font-semibold text-emerald-50">{value}</div>
  </div>
)

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#071511] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(94,234,212,0.18),_transparent_60%),radial-gradient(circle_at_80%_20%,_rgba(16,185,129,0.2),_transparent_50%),linear-gradient(120deg,_rgba(6,18,14,1),_rgba(4,10,8,1))]" />
      <div className="pointer-events-none absolute inset-0 opacity-30 mix-blend-screen [background-image:radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.12),transparent_40%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.08),transparent_40%)]" />

      <header className="relative mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-6 px-6 pt-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-400/10">
            <span className="text-lg font-semibold text-emerald-100">29</span>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.45em] text-emerald-200/80">TwentyNine</p>
            <p className="text-sm text-slate-300">South Asian trick-taking</p>
          </div>
        </div>
        <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
          <a href="#how" className="transition hover:text-emerald-200">
            How it plays
          </a>
          <a href="#modes" className="transition hover:text-emerald-200">
            Modes
          </a>
          <a href="#rules" className="transition hover:text-emerald-200">
            Rules
          </a>
        </nav>
        <Button asChild variant="secondary" className="border border-emerald-200/30 bg-emerald-50 text-emerald-900">
          <Link href="/game">
            Start solo <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </header>

      <main className="relative mx-auto grid w-full max-w-6xl gap-12 px-6 pb-24 pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <section className="space-y-6">
          <Badge className="w-fit border border-emerald-200/30 bg-emerald-400/10 text-emerald-100">
            Solo table is live
          </Badge>
          <h1 className="text-4xl font-semibold leading-tight text-emerald-50 md:text-5xl">
            A modern table for the classic 29 card game.
          </h1>
          <p className="text-base leading-relaxed text-slate-300 md:text-lg">
            Bid, conceal trump, and engineer the last trick. TwentyNine is built for deliberate play with crisp visual
            cues so you always know what matters next.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg" className="bg-emerald-400 text-emerald-950 hover:bg-emerald-300">
              <Link href="/game">
                Play the solo table <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-emerald-200/40 bg-transparent text-emerald-100 hover:bg-emerald-400/10"
            >
              <a href="#rules">Learn the rules</a>
            </Button>
          </div>
          <div className="grid gap-4 pt-2 sm:grid-cols-3">
            <QuickStat label="Hand" value="8 tricks" />
            <QuickStat label="Deck" value="32 cards" />
            <QuickStat label="Points" value="29 total" />
          </div>
        </section>

        <section className="relative">
          <div className="absolute inset-0 -rotate-2 rounded-[32px] border border-emerald-200/10 bg-emerald-500/5" />
          <div className="relative rounded-[32px] border border-emerald-200/20 bg-gradient-to-br from-emerald-950/90 via-emerald-900/60 to-slate-950/90 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-200/20 bg-emerald-400/10">
                  <Crown className="h-5 w-5 text-emerald-200" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-50">Table Preview</p>
                  <p className="text-xs text-emerald-200/70">Solo - Deterministic bots</p>
                </div>
              </div>
              <Badge className="border border-emerald-200/30 bg-emerald-400/10 text-emerald-100">Round 3</Badge>
            </div>

            <div className="mt-6 grid gap-4">
              <div className="grid grid-cols-3 gap-4">
                {["Bot 2", "Bot 3", "Bot 1"].map((label) => (
                  <div key={label} className="rounded-2xl border border-emerald-200/10 bg-black/30 p-4 text-center">
                    <div className="text-xs uppercase tracking-[0.2em] text-emerald-200/60">{label}</div>
                    <div className="mt-3 flex justify-center gap-1">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div
                          key={`${label}-${i}`}
                          className="h-10 w-7 rounded-lg border border-emerald-200/20 bg-gradient-to-br from-emerald-50 to-emerald-100/40"
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-3xl border border-emerald-200/20 bg-emerald-950/60 p-6">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-emerald-200/70">
                  <span>Current trick</span>
                  <span>Trump hidden</span>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-4">
                  {
                    [
                      { label: "West", card: "J♠" },
                      { label: "North", card: "9♠" },
                      { label: "East", card: "Q♠" },
                      { label: "You", card: "A♠" },
                    ].map((slot) => (
                      <div key={slot.label} className="rounded-2xl border border-emerald-200/10 bg-black/40 p-3">
                        <div className="text-xs text-emerald-200/60">{slot.label}</div>
                        <div className="mt-2 text-lg font-semibold text-emerald-50">{slot.card}</div>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between rounded-2xl border border-emerald-200/20 bg-black/40 px-4 py-3">
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-emerald-200/60">Your hand</div>
                <div className="mt-1 text-sm text-emerald-50">Play a highlighted card</div>
              </div>
              <div className="flex gap-2">
                {[
                  { label: "J♣", active: true },
                  { label: "9♥", active: false },
                  { label: "10♦", active: true },
                ].map((card) => (
                  <div
                    key={card.label}
                    className={cn(
                      "flex h-12 w-8 items-center justify-center rounded-lg border text-xs font-semibold",
                      card.active
                        ? "border-emerald-300/50 bg-emerald-200 text-emerald-900"
                        : "border-emerald-200/20 bg-emerald-50/20 text-emerald-100"
                    )}
                  >
                    {card.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <section id="how" className="relative mx-auto w-full max-w-6xl px-6 pb-20">
        <div className="grid gap-6 md:grid-cols-3">
          {featureCards.map((feature) => (
            <div
              key={feature.title}
              className="rounded-3xl border border-emerald-200/10 bg-black/40 p-6 shadow-[0_20px_40px_rgba(0,0,0,0.35)]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-200/20 bg-emerald-400/10">
                <feature.icon className="h-5 w-5 text-emerald-200" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-emerald-50">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-emerald-100/70">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="modes" className="relative mx-auto w-full max-w-6xl px-6 pb-20">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-3xl border border-emerald-200/10 bg-emerald-950/70 p-6">
            <h2 className="text-2xl font-semibold text-emerald-50">Solo today, multiplayer tomorrow</h2>
            <p className="mt-3 text-sm text-emerald-100/70">
              Train with deterministic bots and transparent hints. Multiplayer, LLM opponents, and ranked play are on the
              roadmap once the table feels perfect.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-xs text-emerald-100/70">
              {[
                "Deterministic play",
                "Revealed trump logic",
                "Royals (K+Q) support",
                "Seeded engine",
              ].map((tag) => (
                <span key={tag} className="rounded-full border border-emerald-200/20 bg-black/40 px-3 py-1">
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-emerald-200/10 bg-black/50 p-6">
            <h3 className="text-lg font-semibold text-emerald-50">Upcoming</h3>
            <ul className="mt-4 space-y-3 text-sm text-emerald-100/70">
              <li>- Real-time tables with friends</li>
              <li>- Ranked ladders with season formats</li>
              <li>- Drafted house rules & custom bids</li>
              <li>- Voice and table-chat emotes</li>
            </ul>
          </div>
        </div>
      </section>

      <section id="rules" className="relative mx-auto w-full max-w-6xl px-6 pb-24">
        <div className="rounded-3xl border border-emerald-200/10 bg-black/50 p-8">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-emerald-50">Rules at a glance</h2>
            <Badge className="border border-emerald-200/20 bg-emerald-400/10 text-emerald-100">29 points total</Badge>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {[
              "32-card deck: 7 through A in each suit",
              "Rank order: J > 9 > A > 10 > K > Q > 8 > 7",
              "Trump chosen by bidder, revealed on first break",
              "Last trick wins +1 bonus point",
            ].map((rule) => (
              <div key={rule} className="rounded-2xl border border-emerald-200/10 bg-emerald-950/50 px-4 py-3">
                <span className="text-sm text-emerald-100/80">{rule}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
