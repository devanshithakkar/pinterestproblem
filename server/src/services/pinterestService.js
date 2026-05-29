function requireValue(value, message) {
  if (!value) throw new Error(message);
}

export function isPinterestConfigured() {
  return Boolean(process.env.PINTEREST_ACCESS_TOKEN);
}

export async function createPinterestPin({ boardId, imageUrl, title, description, link }) {
  const accessToken = process.env.PINTEREST_ACCESS_TOKEN;
  const apiBase = process.env.PINTEREST_API_BASE || "https://api.pinterest.com/v5";

  requireValue(accessToken, "Pinterest publishing is not configured.");
  requireValue(boardId, "Pinterest board id is required.");
  requireValue(imageUrl, "A valid image URL is required.");

  try {
    new URL(imageUrl);
  } catch {
    throw new Error("A valid image URL is required.");
  }

  const payload = {
    board_id: boardId,
    title: title || "PinMind Pin",
    description: description || "",
    link: link || imageUrl,
    media_source: {
      source_type: "image_url",
      url: imageUrl,
    },
  };

  const response = await fetch(`${apiBase.replace(/\/$/, "")}/pins`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : { message: await response.text() };

  if (!response.ok) {
    const message = data.message || data.error?.message || data.error || `Pinterest API failed with status ${response.status}`;
    throw new Error(message);
  }

  return data;
}
