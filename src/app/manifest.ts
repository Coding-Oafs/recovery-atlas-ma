import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Recovery Atlas Northeast",
    short_name: "Recovery Atlas",
    description: "Find recovery and treatment resources across the Northeast.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f7f2",
    theme_color: "#174c42",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
