import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

it("renders the loading shell before hydration", async () => {
  vi.resetModules();
  vi.doMock("react", async () => {
    const actual = await vi.importActual<typeof import("react")>("react");
    return {
      ...actual,
      useSyncExternalStore: () => false,
    };
  });

  const { default: GamePage } = await import("@/app/game/page");
  render(<GamePage />);

  expect(screen.getByText(/Shuffling the deck/i)).toBeInTheDocument();
});
