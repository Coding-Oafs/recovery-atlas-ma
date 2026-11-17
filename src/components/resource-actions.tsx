"use client";
import { T, useLanguage } from "./language-provider";
import { useState } from "react";
import { resourceLink } from "@/lib/directory-navigation";
import { resourceActions } from "@/lib/resource-links";
import { publicSiteUrl } from "@/lib/site";
import type { Resource } from "@/lib/types";
export function ShareResource({ resource }: { resource: Resource }) {
  const { t } = useLanguage();

  const [status, setStatus] = useState("");
  return (
    <div className="share-resource">
      <button
        className="text-link"
        onClick={async () => {
          const url = publicSiteUrl + resourceLink(resource.id);
          try {
            await navigator.clipboard.writeText(url);
            setStatus("Listing link copied.");
          } catch {
            setStatus("Copy this listing link:");
          }
        }}
      >
        {" "}
        <T>Copy listing link</T>{" "}
      </button>
      <span role="status">{t(status)}</span>
      {status === "Copy this listing link:" ? (
        <a href={resourceLink(resource.id)}>
          {publicSiteUrl + resourceLink(resource.id)}
        </a>
      ) : null}
    </div>
  );
}
export default function ResourceActions({ resource }: { resource: Resource }) {
  const { t } = useLanguage();

  return (
    <div
      className="resource-quick-actions"
      aria-label={`Quick actions for ${resource.name}`}
    >
      {resourceActions(resource).map((a) => (
        <a
          key={t(a.label)}
          href={a.href}
          target={a.external ? "_blank" : undefined}
          rel={a.external ? "noopener noreferrer" : undefined}
        >
          {a.label}
        </a>
      ))}
    </div>
  );
}
