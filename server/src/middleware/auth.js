import { supabaseAdmin } from "../lib/supabaseClient.js";
import { upsertProfile } from "../services/databaseService.js";

function devFallbackUser() {
  if (process.env.ALLOW_DEV_USER_FALLBACK !== "true" || !process.env.DEV_USER_ID) return null;
  return {
    id: process.env.DEV_USER_ID,
    email: "dev@pinmind.local",
    user_metadata: { full_name: "Local Dev User" },
  };
}

export async function requireAuth(req, res, next) {
  try {
    const header = req.get("authorization") || "";
    const token = header.match(/^Bearer\s+(.+)$/i)?.[1];

    if (!token) {
      const fallback = devFallbackUser();
      if (fallback) {
        req.user = fallback;
        return next();
      }
      return res.status(401).json({ message: "Authentication required." });
    }

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ message: "Invalid or expired session." });
    }

    req.user = data.user;
    await upsertProfile(data.user);
    return next();
  } catch (error) {
    console.error("Auth middleware failed", error);
    return res.status(401).json({ message: "Unable to verify session." });
  }
}
