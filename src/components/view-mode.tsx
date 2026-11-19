"use client";

import { useSyncExternalStore } from "react";
import { viewModeKey } from "@/lib/view-mode";

const viewModeEvent = "atlas:view-mode-change";
const standardView = () => "standard";
const readView = () =>
  document.documentElement.dataset.viewMode === "dark" ? "dark" : "standard";

function subscribe(listener: () => void) {
  window.addEventListener(viewModeEvent, listener);
  return () => window.removeEventListener(viewModeEvent, listener);
}

export function useViewMode() {
  return useSyncExternalStore(subscribe, readView, standardView);
}

export function ViewModeSelect({ language }: { language: string }) {
  const view = useViewMode();
  const spanish = language === "es";
  return (
    <label>
      {spanish ? "Modo de vista" : "View mode"}{" "}
      <select
        value={view}
        onChange={(event) => {
          const mode = event.target.value === "dark" ? "dark" : "standard";
          document.documentElement.dataset.viewMode = mode;
          try {
            localStorage.setItem(viewModeKey, mode);
          } catch {}
          window.dispatchEvent(new Event(viewModeEvent));
        }}
      >
        <option value="standard">{spanish ? "Estándar" : "Standard"}</option>
        <option value="dark">{spanish ? "Oscuro" : "Dark"}</option>
      </select>
    </label>
  );
}
