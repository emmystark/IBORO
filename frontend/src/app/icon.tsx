import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 7,
          background: "#1b1e24",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width={18} height={18} viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="40" fill="none" stroke="#f4f2ee" strokeWidth="14" />
          <rect x="55" y="14" width="10" height="20" fill="#1b1e24" />
          <circle cx="60" cy="60" r="14" fill="#3ddbd0" />
        </svg>
      </div>
    ),
    size
  );
}
