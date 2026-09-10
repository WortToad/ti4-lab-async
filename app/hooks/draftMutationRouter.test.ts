import { createMemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { createOrderedLoader } from "./orderedLoader";

describe("draft mutation and refresh ordering", () => {
  it("discards a delayed pre-pick refresh after a router-managed stage request commits", async () => {
    let staged: string | null = null;
    let releaseOld!: () => void;
    const oldRead = new Promise<void>((resolve) => {
      releaseOld = resolve;
    });
    const ordered = createOrderedLoader<{ staged: string | null }>();
    const loader = vi.fn(() =>
      ordered("draft", async () => {
        const snapshot = { staged };
        if (!staged) await oldRead;
        return snapshot;
      }),
    );
    const router = createMemoryRouter(
      [
        { id: "draft", path: "/draft", loader },
        {
          id: "stage",
          path: "/stage",
          action: () => {
            staged = "hacan";
            return { success: true };
          },
        },
      ],
      {
        initialEntries: ["/draft"],
        hydrationData: { loaderData: { draft: { staged: null } } },
      },
    );
    try {
      const oldRefresh = router.revalidate();
      await vi.waitFor(() => expect(loader).toHaveBeenCalledOnce());
      await router.fetch("pick", "draft", "/stage", {
        formMethod: "post",
        formEncType: "application/json",
        body: { value: "hacan" },
      });
      expect(router.state.errors).toBeNull();
      expect(staged).toBe("hacan");
      expect(router.state.loaderData.draft, "after mutation").toEqual({
        staged: "hacan",
      });
      releaseOld();
      await oldRefresh;
      expect(
        router.state.loaderData.draft,
        "after old refresh resolves",
      ).toEqual({ staged: "hacan" });
    } finally {
      releaseOld();
      router.dispose();
    }
  });
});

describe("authenticated loader ordering", () => {
  it.each([
    new Error("Access expired"),
    new Response("", { status: 302, headers: { Location: "/draft/rejoin" } }),
  ])(
    "rejects a delayed private response after a newer read failed or redirected",
    async (failure) => {
      const ordered = createOrderedLoader<string>();
      let release!: (value: string) => void;
      const old = ordered(
        "room",
        () =>
          new Promise((resolve) => {
            release = resolve;
          }),
      );
      await expect(
        ordered("room", async () => {
          throw failure;
        }),
      ).rejects.toBeDefined();
      const rejectedOld = expect(old).rejects.toBeDefined();
      release("private hand");
      await rejectedOld;
      expect(await ordered("room", async () => "spectator")).toBe("spectator");
    },
  );

  it("does not restore private player data after a newer spectator response", async () => {
    const ordered = createOrderedLoader<{ hand: string[] | null }>();
    let release!: (value: { hand: string[] | null }) => void;
    const old = ordered(
      "room",
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const spectator = { hand: null };
    expect(await ordered("room", async () => spectator)).toBe(spectator);
    release({ hand: ["private"] });
    expect(await old).toBe(spectator);
  });

  it("keeps rooms separate and does not fall back to cached private data when a request fails", async () => {
    const ordered = createOrderedLoader<string>();
    expect(await ordered("a", async () => "A")).toBe("A");
    expect(await ordered("b", async () => "B")).toBe("B");
    await expect(
      ordered("a", async () => {
        throw new Error("Access expired");
      }),
    ).rejects.toThrow("Access expired");
    expect(await ordered("b", async () => "updated B")).toBe("updated B");
  });
});
