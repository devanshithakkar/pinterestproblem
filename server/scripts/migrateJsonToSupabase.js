import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { supabaseAdmin } from "../src/lib/supabaseClient.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, "../data/db.json");

function normalizeTags(tags = []) {
  if (Array.isArray(tags)) {
    return tags.map(String).map((tag) => tag.trim()).filter(Boolean);
  }

  return String(tags)
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase();
}

function validTimestamp(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function assertSupabaseResult({ data, error }, action) {
  if (error) {
    throw new Error(`Supabase ${action} failed: ${error.message}`);
  }

  return data;
}

async function readJsonDb() {
  const raw = await readFile(DB_PATH, "utf8");
  const db = JSON.parse(raw);

  if (!Array.isArray(db.boards)) {
    throw new Error("Expected server/data/db.json to contain a boards array.");
  }

  if (!Array.isArray(db.pins)) {
    throw new Error("Expected server/data/db.json to contain a pins array.");
  }

  return db;
}

async function resolveMigrationUserId() {
  const configuredUserId =
    process.env.MIGRATION_USER_ID || process.env.SUPABASE_MIGRATION_USER_ID || process.env.SUPABASE_USER_ID;

  if (configuredUserId) {
    const profile = assertSupabaseResult(
      await supabaseAdmin.from("profiles").select("id").eq("id", configuredUserId).maybeSingle(),
      "profile lookup",
    );

    if (!profile) {
      throw new Error(`No profile found for MIGRATION_USER_ID=${configuredUserId}. Create the profile first.`);
    }

    return configuredUserId;
  }

  const profiles = assertSupabaseResult(
    await supabaseAdmin.from("profiles").select("id").limit(2),
    "profiles lookup",
  );

  if (profiles.length === 1) {
    return profiles[0].id;
  }

  if (profiles.length === 0) {
    throw new Error(
      "No profiles found. Set MIGRATION_USER_ID to an existing profiles.id value, or create a profile first.",
    );
  }

  throw new Error("Multiple profiles found. Set MIGRATION_USER_ID to the user UUID that should own migrated data.");
}

async function migrateBoards(userId, boards) {
  const existingBoards = assertSupabaseResult(
    await supabaseAdmin.from("boards").select("id, name").eq("user_id", userId),
    "existing boards lookup",
  );

  const boardsByName = new Map(existingBoards.map((board) => [normalizeKey(board.name), board]));
  const boardIdMap = new Map();
  let inserted = 0;
  let skipped = 0;

  for (const board of boards) {
    const name = board.name?.trim() || "Untitled Board";
    const existingBoard = boardsByName.get(normalizeKey(name));

    if (existingBoard) {
      boardIdMap.set(board.id, existingBoard.id);
      skipped += 1;
      console.log(`[board:skip] "${name}" already exists as ${existingBoard.id}; mapped ${board.id}.`);
      continue;
    }

    const row = {
      user_id: userId,
      name,
      description: board.description?.trim() || "A fresh AI-organized board.",
      tags: normalizeTags(board.tags),
      aesthetic: board.aesthetic || "curated visual inspiration",
      cover_image_url: board.coverImageUrl || board.cover_image_url || null,
    };

    const createdAt = validTimestamp(board.createdAt || board.created_at);
    if (createdAt) {
      row.created_at = createdAt;
      row.updated_at = createdAt;
    }

    const insertedBoard = assertSupabaseResult(
      await supabaseAdmin.from("boards").insert(row).select("id, name").single(),
      `insert board "${name}"`,
    );

    boardsByName.set(normalizeKey(insertedBoard.name), insertedBoard);
    boardIdMap.set(board.id, insertedBoard.id);
    inserted += 1;
    console.log(`[board:migrate] "${name}" ${board.id} -> ${insertedBoard.id}.`);
  }

  return { boardIdMap, inserted, skipped };
}

function pinDuplicateKey(pin) {
  return [pin.board_id, pin.image_url, normalizeKey(pin.title)].join("|");
}

async function migratePins(userId, pins, boardIdMap) {
  const existingPins = assertSupabaseResult(
    await supabaseAdmin.from("pins").select("id, board_id, title, image_url").eq("user_id", userId),
    "existing pins lookup",
  );

  const existingPinKeys = new Set(existingPins.map(pinDuplicateKey));
  let inserted = 0;
  let skipped = 0;

  for (const pin of pins) {
    const boardId = boardIdMap.get(pin.boardId || pin.board_id);
    const title = pin.title?.trim() || "Untitled inspiration";
    const imageUrl = pin.imageUrl || pin.image_url;

    if (!boardId) {
      skipped += 1;
      console.log(`[pin:skip] "${title}" references missing board ${pin.boardId || pin.board_id}.`);
      continue;
    }

    if (!imageUrl) {
      skipped += 1;
      console.log(`[pin:skip] "${title}" has no imageUrl.`);
      continue;
    }

    const row = {
      user_id: userId,
      board_id: boardId,
      title,
      caption: pin.caption?.trim() || "",
      tags: normalizeTags(pin.tags),
      image_url: imageUrl,
      source: pin.source || "Upload",
      height: pin.height || 560,
      corrected_at: validTimestamp(pin.correctedAt || pin.corrected_at) || null,
    };

    const createdAt = validTimestamp(pin.createdAt || pin.created_at);
    if (createdAt) {
      row.created_at = createdAt;
      row.updated_at = createdAt;
    }

    const duplicateKey = pinDuplicateKey(row);
    if (existingPinKeys.has(duplicateKey)) {
      skipped += 1;
      console.log(`[pin:skip] "${title}" already exists in board ${boardId}; mapped from ${pin.id}.`);
      continue;
    }

    const insertedPin = assertSupabaseResult(
      await supabaseAdmin.from("pins").insert(row).select("id, title").single(),
      `insert pin "${title}"`,
    );

    existingPinKeys.add(duplicateKey);
    inserted += 1;
    console.log(`[pin:migrate] "${title}" ${pin.id} -> ${insertedPin.id}.`);
  }

  return { inserted, skipped };
}

async function main() {
  const db = await readJsonDb();
  const userId = await resolveMigrationUserId();

  console.log(`Using Supabase user/profile: ${userId}`);
  console.log(`Loaded ${db.boards.length} board(s) and ${db.pins.length} pin(s) from ${DB_PATH}.`);

  const boardResult = await migrateBoards(userId, db.boards);
  const pinResult = await migratePins(userId, db.pins, boardResult.boardIdMap);

  console.log("Migration complete.");
  console.log(`Boards inserted: ${boardResult.inserted}, skipped: ${boardResult.skipped}.`);
  console.log(`Pins inserted: ${pinResult.inserted}, skipped: ${pinResult.skipped}.`);
  console.log("server/data/db.json was not modified.");
}

main().catch((error) => {
  console.error("Migration failed:", error.message);
  process.exit(1);
});
