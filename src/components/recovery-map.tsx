"use client";
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import { type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapPin, Maximize, Search } from "lucide-react";
import type { Resource } from "@/lib/types";
maplibregl.setWorkerUrl(
  new URL(
    "maplibre-gl/dist/maplibre-gl-worker.mjs",
    import.meta.url,
  ).toString(),
);
type Props = {
  resources: Resource[];
  center: { lat: number; lng: number } | null;
  onSelect: (r: Resource) => void;
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
          cluster: true,
          clusterMaxZoom: 12,
          clusterRadius: 38,
        });
        m.addLayer({
          id: "clusters",
          type: "circle",
          source: "resources",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#174c42",
            "circle-radius": [
              "step",
              ["get", "point_count"],
              20,
              10,
              25,
              30,
              30,
            ],
            "circle-stroke-color": "#fff",
            "circle-stroke-width": 3,
          },
        });
        m.addLayer({
          id: "cluster-count",
          type: "symbol",
          source: "resources",
          filter: ["has", "point_count"],
          layout: {
            "text-field": ["get", "point_count_abbreviated"],
            "text-size": 13,
          },
          paint: { "text-color": "#ffffff" },
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
            "circle-radius": 10,
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
        m.on("click", "clusters", async (e) => {
          const f = e.features?.[0];
          if (!f) return;
          const z = await (
            m.getSource("resources") as GeoJSONSource
          ).getClusterExpansionZoom(Number(f.properties?.cluster_id));
          const g = f.geometry;
          if (g.type === "Point")
            m.easeTo({ center: g.coordinates as [number, number], zoom: z });
        });
        m.on("click", "points", (e) => {
          const id = e.features?.[0]?.properties?.id;
          const r = props.current.resources.find((x) => x.id === id);
          if (!r) return;
          const el = document.createElement("div");
          el.className = "pin-popup";
          const name = document.createElement("strong");
          name.textContent = r.name;
          const city = document.createElement("p");
          city.textContent = r.address || r.city;
          const button = document.createElement("button");
          button.textContent = "View details →";
          button.addEventListener("click", () => props.current.onSelect(r));
          el.append(name, city, button);
          new maplibregl.Popup({ offset: 15, maxWidth: "280px" })
            .setLngLat([r.lng!, r.lat!])
            .setDOMContent(el)
            .addTo(m);
        });
        for (const layer of ["clusters", "points"]) {
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
          MASSACHUSETTS
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
