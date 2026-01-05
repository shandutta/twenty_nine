import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { reducer, useToast } from "@/hooks/use-toast";

describe("useToast", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("enforces a single toast and removes on dismiss", () => {
    vi.useFakeTimers();

    const { result, unmount } = renderHook(() => useToast());

    act(() => {
      result.current.toast({ title: "First" });
    });
    expect(result.current.toasts).toHaveLength(1);
    const firstId = result.current.toasts[0].id;

    act(() => {
      result.current.toast({ title: "Second" });
    });
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].id).not.toBe(firstId);

    const activeId = result.current.toasts[0].id;
    act(() => {
      result.current.dismiss(activeId);
    });
    expect(result.current.toasts[0].open).toBe(false);

    act(() => {
      vi.runAllTimers();
    });

    expect(result.current.toasts).toHaveLength(0);
    unmount();
  });

  it("updates and dismisses all toasts via the reducer", () => {
    const initial = { toasts: [] as Array<{ id: string; title?: string; open?: boolean }> };
    const added = reducer(initial, {
      type: "ADD_TOAST",
      toast: { id: "a", title: "Hello", open: true },
    });

    const updated = reducer(added, {
      type: "UPDATE_TOAST",
      toast: { id: "a", title: "Updated" },
    });
    expect(updated.toasts[0]?.title).toBe("Updated");

    const dismissedAll = reducer(updated, { type: "DISMISS_TOAST" });
    expect(dismissedAll.toasts[0]?.open).toBe(false);

    const removedAll = reducer(dismissedAll, { type: "REMOVE_TOAST" });
    expect(removedAll.toasts).toHaveLength(0);
  });

  it("skips duplicate remove queue entries", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.toast({ title: "Once" });
    });
    const id = result.current.toasts[0].id;

    act(() => {
      result.current.dismiss(id);
      result.current.dismiss(id);
    });

    act(() => {
      vi.runAllTimers();
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it("updates and closes a toast via the returned handlers", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useToast());

    let controls: ReturnType<typeof result.current.toast> | null = null;
    act(() => {
      controls = result.current.toast({ title: "Initial" });
    });

    act(() => {
      controls!.update({ id: controls!.id, title: "Changed", open: true });
    });
    expect(result.current.toasts[0]?.title).toBe("Changed");

    act(() => {
      result.current.toasts[0]?.onOpenChange?.(false);
    });

    act(() => {
      vi.runAllTimers();
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it("dismisses only the targeted toast", () => {
    const state = {
      toasts: [
        { id: "a", title: "One", open: true },
        { id: "b", title: "Two", open: true },
      ],
    };

    const next = reducer(state, { type: "DISMISS_TOAST", toastId: "a" });
    expect(next.toasts.find((toast) => toast.id === "a")?.open).toBe(false);
    expect(next.toasts.find((toast) => toast.id === "b")?.open).toBe(true);
  });

  it("ignores updates for unknown toast ids", () => {
    const state = { toasts: [{ id: "a", title: "One", open: true }] };
    const next = reducer(state, { type: "UPDATE_TOAST", toast: { id: "missing", title: "Nope" } });
    expect(next.toasts[0]?.title).toBe("One");
  });
});
