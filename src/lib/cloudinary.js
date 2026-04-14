// ═══════════════════════════════════════════════════════════════════════════
// src/lib/cloudinary.js
// THE JAAGA DESK — Free Image Uploads via Cloudinary
//
// Cloudinary free tier: 25GB storage, 25GB bandwidth/month — more than enough
// Sign up FREE at https://cloudinary.com (no credit card needed)
//
// HOW TO GET YOUR VALUES:
//   1. Go to https://cloudinary.com → sign up free
//   2. Dashboard shows your "Cloud name"
//   3. Settings → Upload → Add upload preset → set to "Unsigned" → save
//   4. Copy the preset name
//   5. Add both values to your .env.local file
// ═══════════════════════════════════════════════════════════════════════════

const CLOUD_NAME   = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

// Upload a base64 image (from a file picker) to Cloudinary
// Returns the public URL of the uploaded image
export async function uploadImage(base64DataUrl, folder = "jaaga") {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    console.warn("Cloudinary not configured — using placeholder image");
    return "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&h=400&fit=crop";
  }

  const formData = new FormData();
  formData.append("file",           base64DataUrl);
  formData.append("upload_preset",  UPLOAD_PRESET);
  formData.append("folder",         folder);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData }
  );

  if (!res.ok) throw new Error("Image upload failed");
  const data = await res.json();
  return data.secure_url; // This is the public image URL
}
