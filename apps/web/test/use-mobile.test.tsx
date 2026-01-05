import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useIsMobile } from "@/hooks/use-mobile";

describe("useIsMobile", () => {
  it("updates when the media query changes", async () => {
    const listeners = new Set<(event?: Event) => void>();
    const matchMediaMock = vi.fn().mockImplementation(() => ({
      matches: false,
      media: "(max-width: 767px)",
      onchange: null,
      addEventListener: (_event: string, handler: (event?: Event) => void) => listeners.add(handler),
      removeEventListener: (_event: string, handler: (event?: Event) => void) => listeners.delete(handler),
      dispatchEvent: () => true,
    }));

    vi.stubGlobal("matchMedia", matchMediaMock as unknown as typeof window.matchMedia);

    Object.defineProperty(window, "innerWidth", { value: 500, writable: true });

    const { result, unmount } = renderHook(() => useIsMobile());

    await waitFor(() => {
      expect(result.current).toBe(true);
    });

    act(() => {
      window.innerWidth = 900;
      listeners.forEach((handler) => handler(new Event("change")));
    });

    await waitFor(() => {
      expect(result.current).toBe(false);
    });

    unmount();
    expect(listeners.size).toBe(0);
  });
});
