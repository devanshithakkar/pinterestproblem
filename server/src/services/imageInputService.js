import { Buffer } from "node:buffer";
import dns from "node:dns/promises";
import net from "node:net";

const MAX_REMOTE_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_REMOTE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function isPrivateIp(address = "") {
  if (!address) return true;
  if (net.isIPv4(address)) {
    const parts = address.split(".").map(Number);
    return (
      parts[0] === 10 ||
      parts[0] === 127 ||
      parts[0] === 0 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168)
    );
  }
  if (net.isIPv6(address)) {
    const value = address.toLowerCase();
    return value === "::1" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80:");
  }
  return true;
}

async function assertPublicImageUrl(imageUrl) {
  let parsed;
  try {
    parsed = new URL(imageUrl);
  } catch {
    const error = new Error("This does not look like a valid image URL.");
    error.status = 400;
    throw error;
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    const error = new Error("Only http and https image URLs are supported.");
    error.status = 400;
    throw error;
  }
  if (["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(parsed.hostname.toLowerCase())) {
    const error = new Error("Local or private network image URLs are not allowed.");
    error.status = 400;
    throw error;
  }

  const addresses = await dns.lookup(parsed.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((entry) => isPrivateIp(entry.address))) {
    const error = new Error("Private network image URLs are not allowed.");
    error.status = 400;
    throw error;
  }

  return parsed;
}

async function fetchWithCheckedRedirects(url, options = {}, redirectCount = 0) {
  await assertPublicImageUrl(url);
  const response = await fetch(url, {
    ...options,
    redirect: "manual",
    signal: AbortSignal.timeout(12_000),
  });
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    if (redirectCount >= 3) {
      const error = new Error("The image URL redirects too many times.");
      error.status = 400;
      throw error;
    }
    const location = response.headers.get("location");
    if (!location) {
      const error = new Error("The image URL redirects without a valid destination.");
      error.status = 400;
      throw error;
    }
    return fetchWithCheckedRedirects(new URL(location, url).toString(), options, redirectCount + 1);
  }
  await assertPublicImageUrl(response.url || url);
  return response;
}

function normalizeImageContentType(value = "") {
  return String(value).split(";")[0].trim().toLowerCase();
}

export async function fetchVerifiedRemoteImage(imageUrl) {
  const head = await fetchWithCheckedRedirects(imageUrl, { method: "HEAD" }).catch(() => null);
  if (head?.ok) {
    const headType = normalizeImageContentType(head.headers.get("content-type"));
    const length = Number(head.headers.get("content-length") || 0);
    if (headType && !ALLOWED_REMOTE_IMAGE_TYPES.has(headType)) {
      const error = new Error("This does not look like a direct image URL.");
      error.status = 400;
      throw error;
    }
    if (length > MAX_REMOTE_IMAGE_BYTES) {
      const error = new Error("Remote image is too large. Use an image under 8MB.");
      error.status = 400;
      throw error;
    }
  }

  const response = await fetchWithCheckedRedirects(imageUrl, { method: "GET" });
  if (!response.ok) {
    const error = new Error(response.status === 403 ? "The image host blocked access." : "The image could not be loaded from that site.");
    error.status = 400;
    throw error;
  }

  const mimeType = normalizeImageContentType(response.headers.get("content-type"));
  if (!ALLOWED_REMOTE_IMAGE_TYPES.has(mimeType)) {
    const error = new Error("This does not look like a direct image URL.");
    error.status = 400;
    throw error;
  }
  const length = Number(response.headers.get("content-length") || 0);
  if (length > MAX_REMOTE_IMAGE_BYTES) {
    const error = new Error("Remote image is too large. Use an image under 8MB.");
    error.status = 400;
    throw error;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_REMOTE_IMAGE_BYTES) {
    const error = new Error("Remote image is too large. Use an image under 8MB.");
    error.status = 400;
    throw error;
  }
  return { buffer, mimeType, finalUrl: response.url || imageUrl };
}

export function normalizeSmartSaveInput(input = {}) {
  return {
    imageUrl: input.imageUrl || input.image_url,
    imageBase64: input.imageBase64 || input.image_base64,
    mimeType: input.mimeType || input.mime_type,
    fileName: input.fileName || input.file_name,
    title: input.title,
    description: input.description,
    caption: input.caption || input.description,
    tags: input.tags,
    providerTags: input.providerTags || input.provider_tags,
    dominantColor: input.dominantColor || input.dominant_color,
    source: input.source,
    sourceUrl: input.sourceUrl || input.source_url,
    provider: input.provider,
    preferredBoardId: input.preferredBoardId || input.preferred_board_id || input.recommendedBoardId || input.recommended_board_id,
    storagePath: input.storagePath || input.storage_path,
    height: input.height,
  };
}

export async function normalizeUrlSmartSaveInput(imageUrl, body = {}) {
  const remoteImage = await fetchVerifiedRemoteImage(imageUrl);
  return normalizeSmartSaveInput({
    ...body,
    imageUrl,
    imageBase64: remoteImage.buffer.toString("base64"),
    mimeType: remoteImage.mimeType,
    fileName: new URL(remoteImage.finalUrl || imageUrl).pathname.split("/").pop() || "remote-image",
    source: body.source || "Image URL",
    sourceUrl: imageUrl,
    provider: body.provider || "url",
    height: Number(body.height) || 580,
  });
}
