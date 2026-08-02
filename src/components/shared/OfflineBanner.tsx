"use client";

import { useAppData } from "@/components/providers/AppDataProvider";
import { Icon } from "./Icon";

/**
 * Connectivity is treated as a normal state, not an edge case — the target
 * users are on intermittent mobile networks (ux-research §3.6).
 */
export function OfflineBanner() {
  const { online } = useAppData();
  if (online) return null;
  return (
    <div className="offline-banner" role="status">
      <Icon name="cloud-off" size={16} style={{ color: "var(--state-warning)", flex: "none" }} />
      <span>You&rsquo;re offline — showing cached text</span>
    </div>
  );
}
