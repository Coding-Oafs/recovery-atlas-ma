"use client";
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapPin, Maximize, Search } from "lucide-react";
import type { Filters, MapResource, MapPoint, Resource } from "@/lib/types";
import { regionBounds } from "@/lib/region";
maplibregl.setWorkerUrl(
  new URL(
    "maplibre-gl/dist/maplibre-gl-worker.mjs",
    import.meta.url,
  ).toString(),
);
type Props = {
  resources: MapResource[];
  filters: Filters;
  saved: string[];
  mappedTotal: number;
  center: { lat: number; lng: number } | null;
  onSelect: (r: MapResource) => void;
  onBounds: (b: number[]) => void;
  highlight: string | null;
};
export default function RegionMap({
  resources,
  filters,
  saved,
  mappedTotal,
  center,
  onSelect,
  onBounds,
  highlight,
}: Props) {
  const container = useRef<HTMLDivElement>(null),
    map = useRef<maplibregl.Map | null>(null),
    props = useRef({ filters, saved, onSelect });
  props.current = { filters, saved, onSelect };
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false),
    [moved, setMoved] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [represented, setRepresented] = useState(0),
    [viewport, setViewport] = useState<{
      bounds: number[];
      zoom: number;
    } | null>(null);
  useEffect(() => {
    if (!container.current) return;
    let m: maplibregl.Map;
    try {
      m = new maplibregl.Map({
        container: container.current,
        style:
          process.env.NEXT_PUBLIC_MAP_STYLE ||
          "https://tiles.openfreemap.org/styles/positron",
        bounds: [
          [regionBounds[0], regionBounds[1]],
          [regionBounds[2], regionBounds[3]],
        ],
        fitBoundsOptions: { padding: 30 },
        maxZoom: 18,
        minZoom: 3,
        attributionControl: { compact: true },
      });
      map.current = m;
      m.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "bottom-right",
      );
      const readView = () => {
        if (m.getCanvas().clientWidth < 100 || m.getCanvas().clientHeight < 100)
          return;
        const b = m.getBounds();
        setViewport({
          bounds: [
            b.getWest(),
            Math.max(-85, b.getSouth()),
            b.getEast(),
            Math.min(85, b.getNorth()),
          ],
          zoom: m.getZoom(),
        });
      };
      m.on("load", () => {
        m.addSource("resources", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        m.addSource("selected", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        m.addLayer({
          id: "clusters",
          type: "circle",
          source: "resources",
          filter: [">", ["get", "count"], 1],
          paint: {
            "circle-color": "#174c42",
            "circle-radius": [
              "step",
              ["get", "count"],
              18,
              25,
              23,
              250,
              29,
              2500,
              35,
            ],
            "circle-stroke-width": 3,
            "circle-stroke-color": "#fff",
          },
        });
        m.addLayer({
          id: "cluster-count",
          type: "symbol",
          source: "resources",
          filter: [">", ["get", "count"], 1],
          layout: {
            "text-field": [
              "case",
              [">=", ["get", "count"], 1000],
              [
                "concat",
                ["to-string", ["round", ["/", ["get", "count"], 1000]]],
                "k",
              ],
              ["to-string", ["get", "count"]],
            ],
            "text-size": 12,
            "text-allow-overlap": true,
          },
          paint: { "text-color": "#fff" },
        });
        m.addLayer({
          id: "points",
          type: "circle",
          source: "resources",
          filter: ["==", ["get", "count"], 1],
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
              3,
              4,
              10,
              7,
              18,
              10,
            ],
            "circle-stroke-color": "#fff",
            "circle-stroke-width": 2,
          },
        });
        m.addLayer({
          id: "highlight",
          type: "circle",
          source: "selected",
          paint: {
            "circle-radius": 16,
            "circle-color": "transparent",
            "circle-stroke-color": "#174c42",
            "circle-stroke-width": 3,
          },
        });
        const choose = (e: maplibregl.MapLayerMouseEvent) => {
          const f = e.features?.[0];
          if (!f || f.geometry.type !== "Point") return;
          const p = f.properties!,
            position = f.geometry.coordinates as [number, number],
            count = Number(p.count);
          if (count === 1) {
            props.current.onSelect({
              id: String(p.id),
              kind: p.kind,
              lat: position[1],
              lng: position[0],
            });
            return;
          }
          if (m.getZoom() < 16) {
            m.easeTo({ center: position, zoom: Math.min(18, m.getZoom() + 2) });
            return;
          }
          const bounds = JSON.parse(String(p.bounds)) as number[],
            el = document.createElement("div");
          el.className = "pin-popup";
          const title = document.createElement("strong");
          title.textContent = `${count.toLocaleString()} resources in this group`;
          const hint = document.createElement("p");
          hint.textContent =
            "Select a resource. Some locations are approximate.";
          const choices = document.createElement("div");
          choices.className = "pin-choices";
          el.append(title, hint, choices);
          async function load(offset: number) {
            choices.replaceChildren();
            choices.textContent = "Loading resources…";
            try {
              const response = await fetch("/api/map-selection", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  filters: props.current.filters,
                  saved: props.current.saved,
                  bounds,
                  offset,
                }),
              });
              if (!response.ok) throw Error("Unavailable");
              const data: { resources: Resource[]; total: number } =
                await response.json();
              choices.replaceChildren();
              for (const r of data.resources) {
                const button = document.createElement("button");
                button.textContent = r.name;
                button.onclick = () => props.current.onSelect(r);
                choices.append(button);
              }
              const pager = document.createElement("p");
              pager.textContent = `${offset + 1}–${Math.min(offset + 100, data.total)} of ${data.total.toLocaleString()}`;
              choices.append(pager);
              for (const [label, next] of [
                ["Previous resources", offset - 100],
                ["More resources at this spot", offset + 100],
              ] as const) {
                if (next < 0 || next >= data.total) continue;
                const button = document.createElement("button");
                button.textContent = label;
                button.onclick = () => load(next);
                choices.append(button);
              }
            } catch {
              choices.textContent =
                "Details temporarily unavailable. Search by name or try again.";
            }
          }
          void load(0);
          new maplibregl.Popup({ offset: 15, maxWidth: "300px" })
            .setLngLat(position)
            .setDOMContent(el)
            .addTo(m);
        };
        for (const layer of ["clusters", "points"]) {
          m.on("click", layer, choose);
          m.on("mouseenter", layer, () => {
            m.getCanvas().style.cursor = "pointer";
          });
          m.on("mouseleave", layer, () => {
            m.getCanvas().style.cursor = "";
          });
        }
        setReady(true);
        readView();
      });
      m.on("moveend", readView);
      m.on("resize", readView);
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
    if (!ready || !viewport) return;
    const abort = new AbortController();
    const timer = setTimeout(async () => {
      setBusy(true);
      setError("");
      try {
        const response = await fetch("/api/map", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filters, saved, ...viewport }),
          signal: abort.signal,
        });
        const data = await response.json();
        if (!response.ok) throw Error(data.error);
        const pins = data.pins as MapPoint[];
        (
          map.current?.getSource("resources") as GeoJSONSource | undefined
        )?.setData({
          type: "FeatureCollection",
          features: pins.map((p) => ({
            type: "Feature",
            properties: {
              id: p.id,
              kind: p.kind,
              count: p.count,
              bounds: JSON.stringify(p.bounds),
            },
            geometry: { type: "Point", coordinates: [p.lng, p.lat] },
          })),
        });
        setRepresented(Number(data.represented));
      } catch (e) {
        if (!abort.signal.aborted) {
          (
            map.current?.getSource("resources") as GeoJSONSource | undefined
          )?.setData({ type: "FeatureCollection", features: [] });
          setRepresented(0);
          setError(e instanceof Error ? e.message : "Map results unavailable");
        }
      } finally {
        if (!abort.signal.aborted) setBusy(false);
      }
    }, 160);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [ready, viewport, filters, saved]);
  useEffect(() => {
    if (center && map.current)
      map.current.flyTo({
        center: [center.lng, center.lat],
        zoom: 10,
        duration: 900,
      });
  }, [center, ready]);
  useEffect(() => {
    if (!ready) return;
    const r = resources.find((r) => r.id === highlight);
    (map.current?.getSource("selected") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features:
        r && r.lat !== null && r.lng !== null
          ? [
              {
                type: "Feature",
                properties: {},
                geometry: { type: "Point", coordinates: [r.lng, r.lat] },
              },
            ]
          : [],
    });
  }, [highlight, resources, ready]);
  useEffect(() => {
    const observer = new ResizeObserver(() => map.current?.resize());
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const reset = () => {
    map.current?.fitBounds(
      [
        [regionBounds[0], regionBounds[1]],
        [regionBounds[2], regionBounds[3]],
      ],
      { padding: 30, duration: 900 },
    );
    setMoved(false);
  };
  return (
    <div
      className="map-wrap"
      data-ready={ready}
      data-represented={represented}
      data-loading={busy}
    >
      <div
        ref={container}
        className="map-canvas"
        role="region"
        aria-label="Interactive map of recovery resources in the Northeast"
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
          <p>Resources and directions remain available in the list.</p>
        </div>
      ) : null}
      <div className="map-top">
        <span className="map-label">
          <span className="live-dot" />
          {mappedTotal.toLocaleString()} MAPPED RESOURCES · GROUPED
        </span>
        <button
          className="map-button"
          onClick={reset}
          aria-label="Show all Northeast states"
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
      <div className="map-caption" role="status">
        {error ||
          (busy
            ? "Updating map…"
            : `${represented.toLocaleString()} resources in this view. Select a group to explore.`)}
      </div>
    </div>
  );
}
