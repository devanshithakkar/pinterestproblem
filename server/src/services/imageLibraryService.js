const fallbackLibraryImages = [
  {
    id: "fallback-desk",
    provider: "mock",
    title: "Sage desk setup",
    description: "A calm desk setup with laptop, soft greens, and focused workspace styling.",
    imageUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=82",
    thumbnailUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=480&q=72",
    sourceUrl: "https://unsplash.com/photos/person-using-macbook-pro-npxXWgQ33ZQ",
    authorName: "Unsplash",
    authorUrl: "https://unsplash.com",
    width: 1200,
    height: 800,
    tags: ["desk", "workspace", "laptop", "coding"],
  },
  {
    id: "fallback-room",
    provider: "mock",
    title: "Soft bedroom shelf",
    description: "Warm room decor with shelves, plants, and cozy neutral interior styling.",
    imageUrl: "https://images.unsplash.com/photo-1616046229478-9901c5536a45?auto=format&fit=crop&w=1200&q=82",
    thumbnailUrl: "https://images.unsplash.com/photo-1616046229478-9901c5536a45?auto=format&fit=crop&w=480&q=72",
    sourceUrl: "https://unsplash.com",
    authorName: "Unsplash",
    authorUrl: "https://unsplash.com",
    width: 1200,
    height: 900,
    tags: ["room", "decor", "interior", "plants"],
  },
  {
    id: "fallback-food",
    provider: "mock",
    title: "Tomato basil pasta",
    description: "Fresh pasta with tomato, basil, and warm food photography tones.",
    imageUrl: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1200&q=82",
    thumbnailUrl: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=480&q=72",
    sourceUrl: "https://unsplash.com",
    authorName: "Unsplash",
    authorUrl: "https://unsplash.com",
    width: 1200,
    height: 900,
    tags: ["food", "recipe", "pasta", "tomato"],
  },
  {
    id: "fallback-fashion",
    provider: "mock",
    title: "Streetwear color story",
    description: "Editorial outfit inspiration with layered streetwear textures.",
    imageUrl: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=82",
    thumbnailUrl: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=480&q=72",
    sourceUrl: "https://unsplash.com",
    authorName: "Unsplash",
    authorUrl: "https://unsplash.com",
    width: 1200,
    height: 1500,
    tags: ["fashion", "outfit", "streetwear", "style"],
  },
];

function queryTags(query) {
  return query
    .split(/\s+/)
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8);
}

function normalizePexelsPhoto(photo, query) {
  return {
    id: String(photo.id),
    provider: "pexels",
    title: photo.alt || `Pexels image ${photo.id}`,
    description: photo.alt || `Image by ${photo.photographer || "Pexels"}`,
    imageUrl: photo.src?.large2x || photo.src?.large || photo.src?.original,
    thumbnailUrl: photo.src?.medium || photo.src?.small || photo.src?.tiny || photo.src?.large,
    sourceUrl: photo.url,
    authorName: photo.photographer,
    authorUrl: photo.photographer_url,
    width: photo.width,
    height: photo.height,
    tags: queryTags(query),
  };
}

function normalizeUnsplashPhoto(photo, query) {
  const unsplashTags = (photo.tags || []).map((tag) => tag.title).filter(Boolean);
  return {
    id: String(photo.id),
    provider: "unsplash",
    title: photo.alt_description || photo.description || `Unsplash image by ${photo.user?.name || "Unsplash"}`,
    description: photo.description || photo.alt_description || `Photo by ${photo.user?.name || "Unsplash"}`,
    imageUrl: photo.urls?.regular || photo.urls?.full || photo.urls?.raw,
    thumbnailUrl: photo.urls?.small || photo.urls?.thumb || photo.urls?.regular,
    sourceUrl: photo.links?.html,
    authorName: photo.user?.name,
    authorUrl: photo.user?.links?.html,
    width: photo.width,
    height: photo.height,
    tags: [...new Set([...unsplashTags, ...queryTags(query)])].slice(0, 10),
  };
}

async function searchPexelsLibrary({ query, page, perPage }) {
  if (!process.env.PEXELS_API_KEY) throw new Error("PEXELS_API_KEY is not configured.");

  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", query);
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("orientation", "all");

  const response = await fetch(url, {
    headers: { Authorization: process.env.PEXELS_API_KEY },
  });
  if (!response.ok) throw new Error(`Pexels search failed with status ${response.status}`);

  const data = await response.json();
  return {
    provider: "pexels",
    images: (data.photos || []).map((photo) => normalizePexelsPhoto(photo, query)),
    pagination: {
      page: data.page || page,
      perPage: data.per_page || perPage,
      totalResults: data.total_results || 0,
      nextPage: data.next_page ? page + 1 : null,
      hasMore: Boolean(data.next_page),
    },
  };
}

async function searchUnsplashLibrary({ query, page, perPage }) {
  if (!process.env.UNSPLASH_ACCESS_KEY) throw new Error("UNSPLASH_ACCESS_KEY is not configured.");

  const url = new URL("https://api.unsplash.com/search/photos");
  url.searchParams.set("query", query);
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("content_filter", "high");

  const response = await fetch(url, {
    headers: {
      Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`,
      "Accept-Version": "v1",
    },
  });
  if (!response.ok) throw new Error(`Unsplash search failed with status ${response.status}`);

  const data = await response.json();
  return {
    provider: "unsplash",
    images: (data.results || []).map((photo) => normalizeUnsplashPhoto(photo, query)),
    pagination: {
      page,
      perPage,
      totalResults: data.total || 0,
      nextPage: page < (data.total_pages || 0) ? page + 1 : null,
      hasMore: page < (data.total_pages || 0),
    },
  };
}

function searchFallbackLibrary({ query, page, perPage }) {
  const normalized = query.trim().toLowerCase();
  const filtered = fallbackLibraryImages.filter((image) =>
    [image.title, image.description, ...(image.tags || [])].join(" ").toLowerCase().includes(normalized),
  );
  const pool = filtered.length ? filtered : fallbackLibraryImages;
  const start = (page - 1) * perPage;
  const repeated = Array.from({ length: Math.ceil((start + perPage) / pool.length) + 1 }, (_, index) =>
    pool.map((image) => ({
      ...image,
      id: `${image.id}-${index}`,
      tags: [...new Set([...(image.tags || []), ...queryTags(normalized)])],
    })),
  ).flat();

  return {
    provider: "mock",
    images: repeated.slice(start, start + perPage),
    pagination: {
      page,
      perPage,
      totalResults: pool.length,
      nextPage: page < 3 ? page + 1 : null,
      hasMore: page < 3,
    },
  };
}

export async function searchImageLibrary({ query, provider = "pexels", page = 1, perPage = 24 }) {
  const normalizedProvider = provider.toLowerCase();
  const attempts =
    normalizedProvider === "unsplash"
      ? [searchUnsplashLibrary, searchPexelsLibrary]
      : normalizedProvider === "all"
        ? [searchPexelsLibrary, searchUnsplashLibrary]
        : [searchPexelsLibrary, searchUnsplashLibrary];

  for (const searchProvider of attempts) {
    try {
      return await searchProvider({ query, page, perPage });
    } catch (error) {
      console.warn(`${searchProvider.name} failed; trying next provider.`, error.message);
    }
  }

  return searchFallbackLibrary({ query, page, perPage });
}
