"use client";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Volume2, Sparkles, Play } from "lucide-react";
import { useState } from "react";

interface SettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  soundEnabled: boolean;
  onSoundChange: (enabled: boolean) => void;
  animationsEnabled: boolean;
  onAnimationsChange: (enabled: boolean) => void;
  autoPlay: boolean;
  onAutoPlayChange: (enabled: boolean) => void;
  onNewGame: () => void;
}

export function SettingsSheet({
  open,
  onOpenChange,
  soundEnabled,
  onSoundChange,
  animationsEnabled,
  onAnimationsChange,
  autoPlay,
  onAutoPlayChange,
  onNewGame,
}: SettingsSheetProps) {
  const [volume, setVolume] = useState([75]);
  const [cardSpeed, setCardSpeed] = useState("normal");
  const [targetScore, setTargetScore] = useState("6");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md bg-sidebar border-sidebar-border gap-0">
        <SheetHeader className="border-sidebar-border/60 bg-sidebar/80 border-b px-4 pb-4 pt-5 pr-10">
          <SheetTitle className="text-sidebar-foreground text-lg tracking-tight">Game Settings</SheetTitle>
          <SheetDescription className="text-muted-foreground/90">
            Customize your Twenty-Nine game experience
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4">
          <div className="space-y-5">
            {/* Audio Settings */}
            <section className="border-sidebar-border/60 bg-sidebar-accent/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] rounded-2xl border p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="bg-sidebar/80 ring-sidebar-border/70 text-primary flex size-9 items-center justify-center rounded-xl ring-1">
                    <Volume2 className="size-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-sidebar-foreground">Audio</h3>
                    <p className="text-xs text-muted-foreground">Sound effects and mix</p>
                  </div>
                </div>
              </div>
              <div className="border-sidebar-border/60 mt-4 space-y-4 border-t pt-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="sound" className="text-sm text-sidebar-foreground">
                      Sound Effects
                    </Label>
                    <p className="text-xs text-muted-foreground">Card shuffles, bids, and trick wins.</p>
                  </div>
                  <Switch id="sound" checked={soundEnabled} onCheckedChange={onSoundChange} />
                </div>
                {soundEnabled && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <Label className="text-muted-foreground">Volume</Label>
                      <span className="text-muted-foreground">{volume[0]}%</span>
                    </div>
                    <Slider value={volume} onValueChange={setVolume} max={100} step={1} className="w-full" />
                  </div>
                )}
              </div>
            </section>

            {/* Visual Settings */}
            <section className="border-sidebar-border/60 bg-sidebar-accent/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] rounded-2xl border p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="bg-sidebar/80 ring-sidebar-border/70 text-primary flex size-9 items-center justify-center rounded-xl ring-1">
                    <Sparkles className="size-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-sidebar-foreground">Visuals</h3>
                    <p className="text-xs text-muted-foreground">Card motion and polish</p>
                  </div>
                </div>
              </div>
              <div className="border-sidebar-border/60 mt-4 space-y-4 border-t pt-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="animations" className="text-sm text-sidebar-foreground">
                      Card Animations
                    </Label>
                    <p className="text-xs text-muted-foreground">Smooth dealing and trick flow.</p>
                  </div>
                  <Switch id="animations" checked={animationsEnabled} onCheckedChange={onAnimationsChange} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Animation Speed</Label>
                  <Select value={cardSpeed} onValueChange={setCardSpeed} disabled={!animationsEnabled}>
                    <SelectTrigger className="border-sidebar-border/70 bg-sidebar/60 w-full hover:bg-sidebar-accent/30">
                      <SelectValue placeholder="Select speed" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="slow">Slow</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="fast">Fast</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            {/* Gameplay Settings */}
            <section className="border-sidebar-border/60 bg-sidebar-accent/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] rounded-2xl border p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="bg-sidebar/80 ring-sidebar-border/70 text-primary flex size-9 items-center justify-center rounded-xl ring-1">
                    <Play className="size-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-sidebar-foreground">Gameplay</h3>
                    <p className="text-xs text-muted-foreground">Hints and scoring goals</p>
                  </div>
                </div>
              </div>
              <div className="border-sidebar-border/60 mt-4 space-y-4 border-t pt-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="autoplay" className="text-sm text-sidebar-foreground">
                      Auto-Play Hints
                    </Label>
                    <p className="text-xs text-muted-foreground">Highlight valid moves</p>
                  </div>
                  <Switch id="autoplay" checked={autoPlay} onCheckedChange={onAutoPlayChange} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Target Score</Label>
                  <Select value={targetScore} onValueChange={setTargetScore}>
                    <SelectTrigger className="border-sidebar-border/70 bg-sidebar/60 w-full hover:bg-sidebar-accent/30">
                      <SelectValue placeholder="Select target" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="4">4 Points (Quick)</SelectItem>
                      <SelectItem value="6">6 Points (Standard)</SelectItem>
                      <SelectItem value="8">8 Points (Extended)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="border-sidebar-border/60 bg-sidebar/60 space-y-3 rounded-xl border p-3">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                    Round Controls
                  </p>
                  <p className="text-xs text-muted-foreground">Shuffle a fresh deck and deal a new round.</p>
                  <Button onClick={onNewGame} className="w-full bg-[#f2c879] text-[#2b1c07] hover:bg-[#f8d690]">
                    Start New Game
                  </Button>
                </div>
              </div>
            </section>

            {/* Reset */}
            <div>
              <Button
                variant="outline"
                className="border-sidebar-border/70 bg-sidebar/40 text-sidebar-foreground hover:bg-sidebar-accent/40 w-full"
              >
                Reset to Defaults
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
