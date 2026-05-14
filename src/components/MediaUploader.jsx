// ═══════════════════════════════════════════════════════════════════════════
// src/components/MediaUploader.jsx
// Admin UI for picking an image OR a video. Uploads File objects directly
// to Cloudinary (no large base64 strings round-trip through React state).
// ═══════════════════════════════════════════════════════════════════════════

import { useRef, useState } from "react";
import { uploadMedia } from "../lib/cloudinary";

const inputStyle = {
  width: "100%", padding: "10px 12px",
  border: "1px solid var(--border)", borderRadius: "var(--radius-md, 10px)",
  background: "var(--bg-primary)", color: "var(--text-primary)",
  fontSize: 14, outline: "none", fontFamily: "inherit",
};

export default function MediaUploader({
  value = "",
  type = "image",
  label = "Media",
  folder = "jaaga/site",
  accept = "image/*,video/*",
  onChange,                       // (url, type) => void
  helper,
}) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const { url, type: detected } = await uploadMedia(file, folder);
      onChange?.(url, detected || (file.type.startsWith("video/") ? "video" : "image"));
    } catch (err) {
      console.error("Media upload failed:", err);
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = ""; // allow re-picking the same file
    }
  };

  const handleUrlChange = (e) => {
    const v = e.target.value.trim();
    onChange?.(v, /\.(mp4|webm|mov|m4v)(\?|$)/i.test(v) ? "video" : type || "image");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {label && (
        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
          {label}
        </label>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          type="text"
          value={value || ""}
          onChange={handleUrlChange}
          placeholder="Paste a Cloudinary or image URL…"
          style={{ ...inputStyle, flex: "1 1 240px" }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          style={{
            padding: "10px 16px",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md, 10px)",
            background: "var(--bg-card)",
            color: "var(--text-secondary)",
            cursor: uploading ? "default" : "pointer",
            fontSize: 14, fontWeight: 500,
            whiteSpace: "nowrap",
            opacity: uploading ? 0.7 : 1,
          }}
        >
          {uploading ? "Uploading…" : "Upload"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={accept}
          style={{ display: "none" }}
          onChange={handleFile}
        />
      </div>
      {helper && !error && (
        <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: 0 }}>{helper}</p>
      )}
      {error && (
        <p style={{ fontSize: 12, color: "#ef4444", margin: 0 }}>⚠ {error}</p>
      )}

      {value && (
        <div style={{
          marginTop: 4,
          borderRadius: "var(--radius-md, 10px)",
          overflow: "hidden",
          border: "1px solid var(--border)",
          aspectRatio: "16/9",
          background: "var(--bg-secondary)",
        }}>
          {type === "video" || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(value) ? (
            <video src={value} autoPlay muted loop playsInline
              style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{
              width: "100%", height: "100%",
              backgroundImage: `url(${value})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }} />
          )}
        </div>
      )}
    </div>
  );
}
