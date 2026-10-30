"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useSaved } from "@/components/saved-provider";
import SavedActions from "@/components/saved-actions";
type Collection = { id: string; name: string };
type Item = { id: string; name: string; collectionId: string | null };
export default function Page() {
  const { user, loading } = useSaved(),
    [loadedFor, setLoadedFor] = useState(""),
    [collections, setCollections] = useState<Collection[]>([]),
    [items, setItems] = useState<Item[]>([]),
    [selected, setSelected] = useState("all"),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const activeOwner = useRef(user?.id);
  activeOwner.current = user?.id;
  async function load() {
    const owner = user?.id;
    const r = await fetch("/api/me/collections", { cache: "no-store" }),
      d = await r.json();
    if (!r.ok) throw Error(d.error);
    if (owner !== activeOwner.current) return;
    setCollections(d.collections);
    setItems(d.items);
    setLoadedFor(user?.id ?? "");
  }
  useEffect(() => {
    setItems([]);
    setCollections([]);
    setLoadedFor("");
    setSelected("all");
    setNotice("");
    if (user)
      void load()
        .catch((e) => setNotice(e.message))
        .finally(() => {
          if (activeOwner.current === user.id) setLoadedFor(user.id);
        });
  }, [user?.id]);
  async function change(body: unknown) {
    setBusy(true);
    try {
      const r = await fetch("/api/me/collections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
        d = await r.json();
      if (!r.ok) throw Error(d.error);
      await load();
      setNotice("Saved lists updated.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  const filtered = items.filter(
    (i) =>
      selected === "all" ||
      (selected === "none" && !i.collectionId) ||
      i.collectionId === selected,
  );
  return (
    <main className="community-page">
      <Link className="text-link" href="/">
        ? Explore resources
      </Link>
      <h1>Organize your saved resources</h1>
      {loading || (user && loadedFor !== user.id) ? (
        <p>Loading�</p>
      ) : !user ? (
        <>
          <p>
            Sign in to organize resources into private lists. Browser saves can
            still be downloaded.
          </p>
          <Link className="primary" href="/account">
            Sign in
          </Link>
          <SavedActions />
        </>
      ) : (
        <>
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void change({ action: "create", name: String(f.get("name")) });
            }}
          >
            <label>
              New private list
              <input
                name="name"
                maxLength={60}
                required
                placeholder="Meetings to try"
              />
            </label>
            <button className="secondary" disabled={busy}>
              Create list
            </button>
          </form>
          <label>
            Show list
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="all">All saved resources</option>
              <option value="none">Not organized into a list</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {selected !== "all" && selected !== "none" ? (
            <details>
              <summary>Remove this list</summary>
              <p>Saved resources remain saved and become unassigned.</p>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => {
                  void change({ action: "delete", id: selected });
                  setSelected("all");
                }}
              >
                Remove list, keep resources
              </button>
            </details>
          ) : null}
          <SavedActions resourceIds={filtered.map((i) => i.id)} />
          <p>{filtered.length} saved resources in this view</p>
          {filtered.map((i) => (
            <article className="peer-card inline-form" key={i.id}>
              <p>{i.name}</p>
              <label>
                List for {i.name}
                <select
                  aria-label={"List for " + i.name}
                  value={i.collectionId ?? ""}
                  disabled={busy}
                  onChange={(e) =>
                    void change({
                      action: "assign",
                      resourceId: i.id,
                      collectionId: e.target.value || null,
                    })
                  }
                >
                  <option value="">Not assigned</option>
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </article>
          ))}
        </>
      )}
      {notice ? (
        <p className="notice" role="status">
          {notice}{" "}
          <button
            className="text-link"
            onClick={() => void load().catch((e) => setNotice(e.message))}
          >
            Refresh saved lists
          </button>
        </p>
      ) : null}
    </main>
  );
}
