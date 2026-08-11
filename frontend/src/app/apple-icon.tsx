import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          borderRadius: 40,
          background: "#1b1e24",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width={104} height={104} viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="40" fill="none" stroke="#f4f2ee" strokeWidth="14" />
          <rect x="55" y="14" width="10" height="20" fill="#1b1e24" />
          <circle cx="60" cy="60" r="14" fill="#3ddbd0" />
        </svg>
      </div>
    ),
    size
  );
}
