"use client";
import { useEffect, useRef, useState } from "react";
import type { MapResource, Resource } from "@/lib/types";
import { resourceIdFromUrl, resourceLink } from "@/lib/directory-navigation";

export function useResourceNavigation(resources: Resource[]) {
  const records = useRef(resources);
  records.current = resources;
  const [selected, setSelected] = useState<Resource | null>(null);
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);
  const previous = useRef<string | null>(null);
  async function read(id: string | null) {
    abort.current?.abort();
    setError("");
    if (!id) {
      setSelected(null);
      return;
    }
    const local = records.current.find((r) => r.id === id);
    if (local) {
      setSelected(local);
      return;
    }
    setSelected(null);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const response = await fetch("/api/resources/" + encodeURIComponent(id), {
        signal: controller.signal,
      });
      if (!response.ok)
        throw Error(
          response.status === 404
            ? "This listing is no longer available."
            : "Resource details are temporarily unavailable. Please try again.",
        );
      const resource: Resource = await response.json();
      if (!controller.signal.aborted) setSelected(resource);
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : "Resource unavailable.");
    }
  }
  const readRef = useRef(read);
  readRef.current = read;
  useEffect(() => {
    const load = () => {
      void readRef.current(resourceIdFromUrl(window.location.href));
    };
    load();
    addEventListener("popstate", load);
    return () => {
      removeEventListener("popstate", load);
      abort.current?.abort();
    };
  }, []);
  useEffect(() => {
    const id = previous.current;
    previous.current = selected?.id ?? null;
    if (!selected && id) {
      const frame = requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>(`[data-resource-id="${id}"] .card-open`)
          ?.focus({ preventScroll: true });
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [selected]);
  function open(resource: Resource | MapResource) {
    if (resourceIdFromUrl(window.location.href) !== resource.id) {
      history.pushState(
        { ...history.state, atlasResourceEntry: true },
        "",
        resourceLink(resource.id),
      );
    }
    if ("name" in resource) {
      abort.current?.abort();
      setError("");
      setSelected(resource);
    } else void read(resource.id);
  }
  function close() {
    if (history.state?.atlasResourceEntry) history.back();
    else {
      const url = new URL(window.location.href);
      url.searchParams.delete("resource");
      history.replaceState(
        { ...history.state, atlasResourceEntry: false },
        "",
        url,
      );
      abort.current?.abort();
      setSelected(null);
    }
  }
  return { selected, open, close, error };
}
