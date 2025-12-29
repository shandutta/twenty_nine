"use client"

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Volume2, Sparkles, Play } from "lucide-react"
import { useState } from "react"

interface SettingsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  soundEnabled: boolean
  onSoundChange: (enabled: boolean) => void
  animationsEnabled: boolean
  onAnimationsChange: (enabled: boolean) => void
  autoPlay: boolean
  onAutoPlayChange: (enabled: boolean) => void
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
}: SettingsSheetProps) {
  const [volume, setVolume] = useState([75])
  const [cardSpeed, setCardSpeed] = useState("normal")
  const [targetScore, setTargetScore] = useState("6")

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md bg-sidebar border-sidebar-border">
        <SheetHeader>
          <SheetTitle className="text-sidebar-foreground">Game Settings</SheetTitle>
          <SheetDescription>Customize your Twenty-Nine game experience</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Audio Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Volume2 className="h-4 w-4" />
              Audio
            </h3>
            <div className="space-y-4 pl-6">
              <div className="flex items-center justify-between">
                <Label htmlFor="sound" className="flex-1">
                  Sound Effects
                </Label>
                <Switch id="sound" checked={soundEnabled} onCheckedChange={onSoundChange} />
              </div>
              {soundEnabled && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Volume</Label>
                  <Slider value={volume} onValueChange={setVolume} max={100} step={1} className="w-full" />
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Visual Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Visuals
            </h3>
            <div className="space-y-4 pl-6">
              <div className="flex items-center justify-between">
                <Label htmlFor="animations" className="flex-1">
                  Card Animations
                </Label>
                <Switch id="animations" checked={animationsEnabled} onCheckedChange={onAnimationsChange} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Animation Speed</Label>
                <Select value={cardSpeed} onValueChange={setCardSpeed}>
                  <SelectTrigger>
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
          </div>

          <Separator />

          {/* Gameplay Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Play className="h-4 w-4" />
              Gameplay
            </h3>
            <div className="space-y-4 pl-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="autoplay" className="flex-1">
                    Auto-Play Hints
                  </Label>
                  <p className="text-xs text-muted-foreground">Highlight valid moves</p>
                </div>
                <Switch id="autoplay" checked={autoPlay} onCheckedChange={onAutoPlayChange} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Target Score</Label>
                <Select value={targetScore} onValueChange={setTargetScore}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select target" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4">4 Points (Quick)</SelectItem>
                    <SelectItem value="6">6 Points (Standard)</SelectItem>
                    <SelectItem value="8">8 Points (Extended)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Reset */}
          <div className="pt-4">
            <Button variant="outline" className="w-full bg-transparent">
              Reset to Defaults
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
