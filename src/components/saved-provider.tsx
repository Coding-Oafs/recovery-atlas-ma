"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { authClient } from "@/lib/auth-client";
const valid = (v: unknown): string[] =>
  Array.isArray(v)
    ? [
        ...new Set(
          v.filter(
            (x): x is string =>
              typeof x === "string" && /^[a-z0-9-]{1,150}$/.test(x),
          ),
        ),
      ].slice(0, 1000)
    : [];
type SavedState = {
  saved: string[];
  guestSaved: string[];
  user: { id: string; name: string } | null;
  loading: boolean;
  error: string;
  syncing: boolean;
  toggleSave: (id: string) => void;
  clearGuest: () => void;
  importGuest: () => Promise<void>;
  refresh: () => Promise<void>;
};
const Context = createContext<SavedState | null>(null);
export function SavedProvider({ children }: { children: React.ReactNode }) {
  const {
    data: session,
    isPending,
    error: sessionError,
  } = authClient.useSession();
  const user = session?.user ?? null,
    userId = user?.id ?? null;
  const [guestSaved, setGuestSaved] = useState<string[]>([]),
    [accountSaved, setAccountSaved] = useState<string[]>([]),
    [loadedUser, setLoadedUser] = useState<string | null>(null),
    [error, setError] = useState(""),
    [pending, setPending] = useState(0);
  const currentUser = useRef(userId),
    pendingIds = useRef(new Set<string>());
  currentUser.current = userId;
  useEffect(() => {
    try {
      let ids = valid(
        JSON.parse(localStorage.getItem("atlas:saved:v1") ?? "[]"),
      );
      const params = new URLSearchParams(location.hash.slice(1));
      if (params.has("import-saves")) {
        ids = valid([
          ...ids,
          ...valid(JSON.parse(params.get("import-saves")!)),
        ]);
        localStorage.setItem("atlas:saved:v1", JSON.stringify(ids));
        history.replaceState(null, "", location.pathname + location.search);
      }
      setGuestSaved(ids);
    } catch {
      setError("Your browser saves could not be loaded.");
    }
    const storage = (e: StorageEvent) => {
      if (e.key === "atlas:saved:v1")
        try {
          setGuestSaved(valid(JSON.parse(e.newValue ?? "[]")));
        } catch {}
    };
    addEventListener("storage", storage);
    return () => removeEventListener("storage", storage);
  }, []);
  const refresh = useCallback(async () => {
    const id = currentUser.current;
    if (!id || pendingIds.current.size) return;
    const response = await fetch("/api/me/saved", { cache: "no-store" });
    const body = await response.json();
    if (currentUser.current !== id) return;
    if (!response.ok)
      throw Error(body.error ?? "Your account saves could not be loaded.");
    if (!pendingIds.current.size) {
      setAccountSaved(valid(body.ids));
      setLoadedUser(id);
      setError("");
    }
  }, []);
  useEffect(() => {
    setAccountSaved([]);
    setLoadedUser(null);
    setError("");
    if (!userId) return;
    let active = true;
    refresh().catch((e) => {
      if (active) setError(e.message);
    });
    const focus = () => {
      refresh().catch((e) => setError(e.message));
    };
    addEventListener("focus", focus);
    const timer = setInterval(focus, 60000);
    return () => {
      active = false;
      removeEventListener("focus", focus);
      clearInterval(timer);
    };
  }, [userId, refresh]);
  const persistGuest = (ids: string[]) => {
    try {
      localStorage.setItem("atlas:saved:v1", JSON.stringify(ids));
    } catch {
      setError(
        "Your browser could not keep these saves. Download a copy to keep them.",
      );
    }
    setGuestSaved(ids);
  };
  const saved = userId
    ? loadedUser === userId
      ? accountSaved
      : []
    : guestSaved;
  const toggleSave = (id: string) => {
    if (isPending || sessionError) {
      setError(
        "Please wait for sign-in to finish loading, then try saving again.",
      );
      return;
    }
    if (userId) {
      if (loadedUser !== userId || pendingIds.current.has(id)) return;
      const was = accountSaved.includes(id),
        next = !was;
      if (next && accountSaved.length >= 1000) {
        setError("You can save up to 1,000 resources.");
        return;
      }
      pendingIds.current.add(id);
      setPending((n) => n + 1);
      setAccountSaved((a) =>
        next ? [...new Set([...a, id])] : a.filter((x) => x !== id),
      );
      setError("");
      void fetch("/api/me/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, saved: next }),
      })
        .then(async (r) => {
          if (!r.ok) {
            const b = await r.json();
            throw Error(b.error);
          }
        })
        .catch((e) => {
          if (currentUser.current === userId) {
            setAccountSaved((a) =>
              was ? [...new Set([...a, id])] : a.filter((x) => x !== id),
            );
            setError(
              e.message ?? "Your change could not be saved. Please try again.",
            );
          }
        })
        .finally(() => {
          pendingIds.current.delete(id);
          setPending((n) => n - 1);
        });
    } else {
      if (!guestSaved.includes(id) && guestSaved.length >= 1000) {
        setError("You can save up to 1,000 resources.");
        return;
      }
      persistGuest(
        guestSaved.includes(id)
          ? guestSaved.filter((x) => x !== id)
          : [...guestSaved, id],
      );
    }
  };
  const importGuest = async () => {
    if (!userId || pendingIds.current.size)
      throw Error("Wait for your saved list to finish loading.");
    const response = await fetch("/api/me/saved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ importIds: guestSaved }),
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.error);
    if (currentUser.current === userId) {
      setAccountSaved(valid(data.ids));
      setLoadedUser(userId);
      if (data.notImported > 0)
        throw Error(
          `${data.notImported} browser saves could not be copied because they are unavailable or your account reached its 1,000-resource limit. Other saves were copied successfully.`,
        );
    }
  };
  return (
    <Context.Provider
      value={{
        saved,
        guestSaved,
        user,
        loading:
          isPending || !!sessionError || (!!userId && loadedUser !== userId),
        error:
          error ||
          (sessionError
            ? "Account status could not be checked. Refresh the page before changing saved resources."
            : ""),
        syncing: pending > 0,
        toggleSave,
        clearGuest: () => persistGuest([]),
        importGuest,
        refresh,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useSaved() {
  const value = useContext(Context);
  if (!value) throw Error("SavedProvider missing");
  return value;
}
