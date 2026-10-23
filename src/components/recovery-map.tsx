"use client";
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import { type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapPin, Maximize, Search } from "lucide-react";
import type { MapResource } from "@/lib/types";
maplibregl.setWorkerUrl(
  new URL(
    "maplibre-gl/dist/maplibre-gl-worker.mjs",
    import.meta.url,
  ).toString(),
);
type Props = {
  resources: MapResource[];
  center: { lat: number; lng: number } | null;
  onSelect: (r: MapResource) => void;
  onBounds: (b: number[]) => void;
  highlight: string | null;
};
export default function RecoveryMap({
  resources,
  center,
  onSelect,
  onBounds,
  highlight,
}: Props) {
  const container = useRef<HTMLDivElement>(null),
    map = useRef<maplibregl.Map | null>(null),
    props = useRef({ resources, onSelect, onBounds });
  props.current = { resources, onSelect, onBounds };
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false),
    [moved, setMoved] = useState(false);
  useEffect(() => {
    if (!container.current) return;
    let m: maplibregl.Map;
    try {
      m = new maplibregl.Map({
        container: container.current,
        style:
          process.env.NEXT_PUBLIC_MAP_STYLE ||
          "https://tiles.openfreemap.org/styles/positron",
        center: [-71.65, 42.12],
        zoom: 7.1,
        maxZoom: 18,
        minZoom: 5,
        attributionControl: { compact: true },
      });
      map.current = m;
      m.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "bottom-right",
      );
      m.on("load", () => {
        m.addSource("resources", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
          cluster: false,
        });
        m.addLayer({
          id: "points",
          type: "circle",
          source: "resources",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": [
              "match",
              ["get", "kind"],
              "meeting",
              "#b57439",
              "hospital",
              "#82618a",
              "treatment",
              "#397b9a",
              "#23715d",
            ],
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              5,
              3,
              8,
              5,
              12,
              8,
              18,
              11,
            ],
            "circle-stroke-color": "#fff",
            "circle-stroke-width": 3,
          },
        });
        m.addLayer({
          id: "highlight",
          type: "circle",
          source: "resources",
          filter: ["==", ["get", "id"], ""],
          paint: {
            "circle-radius": 16,
            "circle-color": "transparent",
            "circle-stroke-color": "#174c42",
            "circle-stroke-width": 3,
          },
        });
        m.on("click", "points", (e) => {
          const ids = [
            ...new Set((e.features ?? []).map((f) => String(f.properties?.id))),
          ];
          const r = props.current.resources.find((x) => x.id === ids[0]);
          if (!r) return;
          if (ids.length === 1) {
            props.current.onSelect(r);
            return;
          }
          const el = document.createElement("div");
          el.className = "pin-popup";
          const name = document.createElement("strong");
          name.textContent = `${ids.length} overlapping resources`;
          const city = document.createElement("p");
          city.textContent =
            "Select a resource below, or zoom closer. Approximate ZIP-area pins can share a location.";
          const choices = document.createElement("div");
          choices.className = "pin-choices";
          el.append(name, city, choices);
          const loadChoices = (offset: number) => {
            choices.replaceChildren();
            choices.textContent = "Loading resources…";
            fetch("/api/map-selection", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ids: ids.slice(offset, offset + 100) }),
            })
              .then((x) => {
                if (!x.ok) throw Error("Selection unavailable");
                return x.json();
              })
              .then((rows: { id: string; name: string }[]) => {
                choices.replaceChildren();
                for (const row of rows) {
                  const button = document.createElement("button");
                  button.textContent = row.name;
                  button.addEventListener("click", () => {
                    const resource = props.current.resources.find(
                      (x) => x.id === row.id,
                    );
                    if (resource) props.current.onSelect(resource);
                  });
                  choices.append(button);
                }
                const pager = document.createElement("p");
                pager.textContent = `${offset + 1}–${Math.min(offset + 100, ids.length)} of ${ids.length}`;
                choices.append(pager);
                if (offset > 0) {
                  const previous = document.createElement("button");
                  previous.textContent = "Previous resources";
                  previous.onclick = () =>
                    loadChoices(Math.max(0, offset - 100));
                  choices.append(previous);
                }
                if (offset + 100 < ids.length) {
                  const next = document.createElement("button");
                  next.textContent = "More resources at this spot";
                  next.onclick = () => loadChoices(offset + 100);
                  choices.append(next);
                }
              })
              .catch(() => {
                choices.textContent =
                  "Please select this resource from the list or search by name.";
              });
          };
          loadChoices(0);
          new maplibregl.Popup({ offset: 15, maxWidth: "280px" })
            .setLngLat([r.lng!, r.lat!])
            .setDOMContent(el)
            .addTo(m);
        });
        for (const layer of ["points"]) {
          m.on("mouseenter", layer, () => {
            m.getCanvas().style.cursor = "pointer";
          });
          m.on("mouseleave", layer, () => {
            m.getCanvas().style.cursor = "";
          });
        }
        setReady(true);
        setFailed(false);
      });
      m.on("dragend", () => setMoved(true));
      m.on("zoomend", (e) => {
        if (e.originalEvent) setMoved(true);
      });
      m.on("error", () => {
        if (!m.isStyleLoaded()) setFailed(true);
      });
    } catch {
      setFailed(true);
    }
    return () => {
      m?.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (!ready || !map.current) return;
    const features = resources
      .filter((r) => r.lat !== null && r.lng !== null)
      .map((r) => ({
        type: "Feature" as const,
        properties: { id: r.id, kind: r.kind },
        geometry: { type: "Point" as const, coordinates: [r.lng!, r.lat!] },
      }));
    (map.current.getSource("resources") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features,
    });
  }, [resources, ready]);
  useEffect(() => {
    if (center && map.current)
      map.current.flyTo({
        center: [center.lng, center.lat],
        zoom: 10,
        duration: 900,
      });
  }, [center, ready]);
  useEffect(() => {
    if (ready)
      map.current?.setFilter("highlight", [
        "==",
        ["get", "id"],
        highlight ?? "",
      ]);
  }, [highlight, ready]);
  useEffect(() => {
    const o = new ResizeObserver(() => map.current?.resize());
    if (container.current) o.observe(container.current);
    return () => o.disconnect();
  }, []);
  function reset() {
    map.current?.fitBounds(
      [
        [-73.52, 41.28],
        [-69.9, 42.89],
      ],
      { padding: 45, duration: 900 },
    );
    setMoved(false);
  }
  return (
    <div className="map-wrap" data-ready={ready}>
      <div
        ref={container}
        className="map-canvas"
        aria-label="Interactive map of recovery resources in Massachusetts"
      />
      {!ready && !failed ? (
        <div className="map-loading">
          <MapPin />
          <span>Finding your bearings…</span>
        </div>
      ) : null}
      {failed ? (
        <div className="map-failure">
          <strong>Map temporarily unavailable</strong>
          <p>All resources and directions are still available in the list.</p>
        </div>
      ) : null}
      <div className="map-top">
        <span className="map-label">
          <span className="live-dot" />
          {resources.filter((r) => r.lat !== null).length.toLocaleString()}{" "}
          INDIVIDUAL MAP PINS
        </span>
        <button
          className="map-button"
          onClick={reset}
          aria-label="Show all Massachusetts"
        >
          <Maximize size={16} />
        </button>
      </div>
      {moved ? (
        <button
          className="search-area"
          onClick={() => {
            const b = map.current?.getBounds();
            if (b)
              onBounds([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
            setMoved(false);
          }}
        >
          <Search size={16} />
          Search this area
        </button>
      ) : null}
      <div className="map-legend">
        <span>
          <i className="legend-dot care" />
          Care & support
        </span>
        <span>
          <i className="legend-dot meeting" />
          Meetings
        </span>
        <span>
          <i className="legend-dot hospital" />
          Hospitals
        </span>
      </div>
      <div className="map-caption">
        A place to start. A community to keep going.
      </div>
    </div>
  );
}
