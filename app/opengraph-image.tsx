import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

// The picture shown when someone shares a link to the site (Discord, iMessage, Instagram, ...).
export const alt = `${SITE_NAME}: ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BRAND = "#0064a4";
const FEATURES = ["4-year plan with prerequisites", "GEs you can actually take", "Weekly calendar with live seats"];

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "white", padding: "72px 80px", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: 14, background: BRAND, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38, fontWeight: 700 }}>
            {SITE_NAME[0]}
          </div>
          <div style={{ fontSize: 40, fontWeight: 700, color: "#111827" }}>{SITE_NAME}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 72, fontWeight: 700, color: "#111827", lineHeight: 1.1, letterSpacing: -2 }}>Your college path,</div>
          <div style={{ fontSize: 72, fontWeight: 700, color: BRAND, lineHeight: 1.1, letterSpacing: -2 }}>designed for you.</div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
          {FEATURES.map((f) => (
            <div key={f} style={{ display: "flex", padding: "10px 20px", borderRadius: 999, background: "#e6f0f7", color: "#0b3a5c", fontSize: 24 }}>{f}</div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
