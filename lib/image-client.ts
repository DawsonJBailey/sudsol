// Client-side image normalization for the vision endpoints.
//
// A file's extension (and even the browser's reported MIME type) can lie: photos
// saved from Google Images are frequently AVIF or WebP, and phones save HEIC —
// all of which browsers happily display but which either fail our server-side
// magic-byte check or aren't accepted by the vision API at all (it only takes
// JPEG/PNG/GIF/WebP).
//
// So instead of trusting the incoming bytes, we decode the image (anything the
// browser can render) and re-encode it to a clean JPEG on a canvas. Whatever the
// visitor uploads, the server receives a guaranteed-valid JPEG. We also cap the
// long edge to keep the upload small.

export type NormalizedImage = { dataUrl: string; base64: string };

export async function fileToVisionJpeg(file: File, maxEdge = 1568): Promise<NormalizedImage> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);

    const longest = Math.max(img.naturalWidth, img.naturalHeight) || 1;
    const scale = Math.min(1, maxEdge / longest);
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser can't process images.");

    // Flatten onto white so transparent PNGs don't come through as black.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    const base64 = dataUrl.split(",")[1] ?? "";
    if (!base64) throw new Error("Could not read that image.");

    return { dataUrl, base64 };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read that image. Try a different photo."));
    img.src = src;
  });
}
