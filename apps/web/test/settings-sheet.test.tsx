import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { SettingsSheet } from "@/components/game/settings-sheet";

const renderSheet = (overrides?: Partial<ComponentProps<typeof SettingsSheet>>) => {
  const props: ComponentProps<typeof SettingsSheet> = {
    open: true,
    onOpenChange: vi.fn(),
    soundEnabled: true,
    onSoundChange: vi.fn(),
    soundVolume: 75,
    onSoundVolumeChange: vi.fn(),
    animationsEnabled: true,
    onAnimationsChange: vi.fn(),
    autoPlay: false,
    onAutoPlayChange: vi.fn(),
    easyMode: false,
    onEasyModeChange: vi.fn(),
    onNewGame: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<SettingsSheet {...props} />) };
};

describe("SettingsSheet", () => {
  it("toggles easy mode and sound effects", () => {
    const { props } = renderSheet();

    const easyModeSwitch = screen.getByRole("switch", { name: /Easy Mode/i });
    fireEvent.click(easyModeSwitch);
    expect(props.onEasyModeChange).toHaveBeenCalledWith(true);

    const soundSwitch = screen.getByRole("switch", { name: /Sound Effects/i });
    fireEvent.click(soundSwitch);
    expect(props.onSoundChange).toHaveBeenCalledWith(false);
  });
});
