// ═══════════════════════════════════════════════════════════════════════════
// src/lib/cloudinary.js
// THE JAAGA DESK — Free Image & Video Uploads via Cloudinary
//
// HOW TO GET YOUR VALUES:
//   1. Go to https://cloudinary.com → sign up free
//   2. Dashboard shows your "Cloud name"
//   3. Settings → Upload → Add upload preset → set to "Unsigned" → save
//      IMPORTANT: enable both image AND video formats in that preset
//   4. Copy the preset name
//   5. Add both values to your .env.local file
// ═══════════════════════════════════════════════════════════════════════════

const CLOUD_NAME    = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

const PLACEHOLDER_IMAGE = "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1600&h=900&fit=crop";
const PLACEHOLDER_VIDEO = "https://res.cloudinary.com/demo/video/upload/v1/elephants.mp4";

const isVideoSource = (input) => {
  if (typeof input === "string") return input.startsWith("data:video/");
  return input && input.type && input.type.startsWith("video/");
};

async function rawUpload(source, folder, resourceType) {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    console.warn("Cloudinary not configured — using placeholder media");
    return {
      url: resourceType === "video" ? PLACEHOLDER_VIDEO : PLACEHOLDER_IMAGE,
      type: resourceType,
      width: null, height: null, publicId: null,
    };
  }

  const formData = new FormData();
  formData.append("file", source);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", folder);

  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;
  const res = await fetch(endpoint, { method: "POST", body: formData });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Cloudinary ${resourceType} upload failed (${res.status}): ${errBody.slice(0, 200)}`);
  }
  const data = await res.json();
  return {
    url:      data.secure_url,
    type:     resourceType,
    width:    data.width  ?? null,
    height:   data.height ?? null,
    publicId: data.public_id ?? null,
  };
}

// Back-compat: returns just the URL string (used by avatars, post covers)
export async function uploadImage(source, folder = "jaaga") {
  const result = await rawUpload(source, folder, "image");
  return result.url;
}

// Returns just the URL string for video uploads
export async function uploadVideo(source, folder = "jaaga/videos") {
  const result = await rawUpload(source, folder, "video");
  return result.url;
}

// Rich upload — auto-detects type, returns { url, type, width, height, publicId }
// Use this for the site-media uploader that needs to know image vs video.
export async function uploadMedia(source, folder = "jaaga/media") {
  const kind = isVideoSource(source) ? "video" : "image";
  return rawUpload(source, folder, kind);
}
