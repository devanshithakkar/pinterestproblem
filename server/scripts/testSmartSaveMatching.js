import assert from "node:assert/strict";
import { analyzeImageForBoards } from "../src/services/aiService.js";
import { findReusableBoard, getCategoryBoardName, sanitizeBoardName } from "../src/services/boardNameService.js";

const naturePins = Array.from({ length: 5 }, (_, index) => ({
  id: `nature-pin-${index}`,
  boardId: "nature",
  title: ["Forest trail", "Mountain lake", "Wildflower field", "Beach sunset", "Garden plants"][index],
  caption: "Nature landscape outdoor greenery",
  tags: ["nature", "forest", "flower", "landscape"],
}));

const boards = [
  {
    id: "nature",
    name: "Nature",
    description: "Flowers, forests, mountains, beaches, and landscape inspiration.",
    tags: ["nature", "flower", "forest", "landscape"],
  },
  {
    id: "fashion",
    name: "Fashion",
    description: "Outfits, dresses, streetwear, clothing, and accessories.",
    tags: ["fashion", "outfit", "dress", "style"],
  },
  {
    id: "music",
    name: "Concerts / Music Events",
    description: "Concerts, festivals, live music, stages, and performers.",
    tags: ["concert", "music", "festival", "stage"],
  },
  {
    id: "campus",
    name: "Campus Life / Friends",
    description: "Campus memories, friends, college life, and group photos.",
    tags: ["campus", "friends", "college", "students"],
  },
  {
    id: "tech",
    name: "Coding / Tech",
    description: "Code editors, dashboards, UI screenshots, laptops, and software.",
    tags: ["coding", "tech", "dashboard", "laptop"],
  },
];

function assertBoard(image, expectedBoardId, label) {
  const result = analyzeImageForBoards({ boards, pins: naturePins, image });
  assert.notEqual(result.predictedBoardId, "nature", `${label}: Nature should not win`);
  assert.equal(result.predictedBoardId, expectedBoardId, `${label}: expected ${expectedBoardId}`);
  assert.notEqual(result.action, "suggest_new_board", `${label}: should match an existing category board`);
}

assertBoard(
  {
    primaryCategory: "fashion",
    primarySubject: "woman in summer dress",
    detectedObjects: ["dress", "person"],
    detectedTags: ["fashion", "outfit", "dress", "outdoor", "green"],
    environment: "outdoors with trees",
    isFashion: true,
  },
  "fashion",
  "Dress outdoors",
);

assertBoard(
  {
    primaryCategory: "music",
    primarySubject: "outdoor concert crowd",
    detectedObjects: ["stage", "singer", "crowd"],
    detectedTags: ["concert", "music", "festival", "outdoor"],
    environment: "outdoors",
    isMusicOrConcert: true,
  },
  "music",
  "Outdoor concert",
);

assertBoard(
  {
    primaryCategory: "campus life",
    primarySubject: "group of friends on campus",
    detectedObjects: ["friends", "students", "campus"],
    detectedTags: ["friends", "college", "campus", "trees"],
    environment: "outdoors",
    isCampusOrFriends: true,
  },
  "campus",
  "Campus friends",
);

const natureResult = analyzeImageForBoards({
  boards,
  pins: naturePins,
  image: {
    primaryCategory: "nature",
    primarySubject: "wildflower meadow",
    detectedObjects: ["flowers", "plants"],
    detectedTags: ["flower", "nature", "landscape"],
    environment: "outdoors",
  },
});
assert.equal(natureResult.predictedBoardId, "nature", "Flower/forest image should still match Nature");

assertBoard(
  {
    primaryCategory: "coding",
    primarySubject: "code editor dashboard",
    detectedObjects: ["laptop", "dashboard", "code editor"],
    detectedTags: ["coding", "tech", "ui", "screen"],
    environment: "screen",
    isTech: true,
  },
  "tech",
  "Coding screenshot",
);

const onlyNatureFashion = analyzeImageForBoards({
  boards: [boards[0]],
  pins: naturePins,
  image: {
    primaryCategory: "fashion",
    primarySubject: "outdoor dress portrait",
    detectedObjects: ["dress", "person"],
    detectedTags: ["fashion", "dress", "outdoor", "green"],
    environment: "outdoors",
    isFashion: true,
  },
});
assert.equal(onlyNatureFashion.action, "suggest_new_board", "Fashion image with only Nature available should suggest a new board");
assert.equal(onlyNatureFashion.suggestedBoardName, "Fashion", "Fashion fallback should create/reuse Fashion, not Nature");

const vehicleResult = analyzeImageForBoards({
  boards: [
    ...boards,
    {
      id: "vehicles",
      name: "Vehicles",
      description: "Cars, bikes, motorcycles, and automotive references.",
      tags: ["vehicle", "car", "motorcycle", "bike"],
    },
  ],
  pins: naturePins,
  image: {
    primaryCategory: "fashion",
    primarySubject: "woman in red dress",
    detectedObjects: ["dress", "person"],
    detectedTags: ["fashion", "dress", "style"],
    isFashion: true,
  },
});
assert.notEqual(vehicleResult.predictedBoardId, "vehicles", "Fashion image must not be saved to Vehicles");

const vehicleOnly = analyzeImageForBoards({
  boards: [
    {
      id: "vehicles",
      name: "Vehicles",
      description: "Cars, bikes, motorcycles, and automotive references.",
      tags: ["vehicle", "car", "motorcycle", "bike"],
    },
  ],
  pins: [],
  image: {
    primaryCategory: "vehicle",
    primarySubject: "classic car",
    detectedObjects: ["car", "road"],
    detectedTags: ["vehicle", "car", "automotive"],
    isVehicle: true,
  },
});
assert.equal(vehicleOnly.predictedBoardId, "vehicles", "Vehicle image should match Vehicles");

const animalSuggestion = getCategoryBoardName({
  primaryCategory: "animal",
  primarySubject: "golden retriever puppy",
  detectedObjects: ["dog"],
  isAnimal: true,
});
assert.equal(animalSuggestion, "Animals", "Animal analysis should map to Animals");

const campusSuggestion = getCategoryBoardName({
  primaryCategory: "campus life",
  primarySubject: "group of friends",
  detectedTags: ["campus", "friends", "college"],
  isCampusOrFriends: true,
});
assert.equal(campusSuggestion, "Campus Life / Friends", "Campus friends should map to Campus Life / Friends");

const concertSuggestion = getCategoryBoardName({
  primaryCategory: "music event",
  primarySubject: "outdoor concert stage",
  detectedObjects: ["stage", "crowd"],
  isMusicOrConcert: true,
});
assert.equal(concertSuggestion, "Concerts / Music Events", "Concert should map to Concerts / Music Events");

const cardiganSuggestion = getCategoryBoardName({
  primaryCategory: "fashion",
  primarySubject: "cardigan outfit",
  detectedObjects: ["cardigan", "dress"],
  detectedTags: ["fashion", "outfit"],
  isFashion: true,
});
assert.equal(cardiganSuggestion, "Fashion", "Fashion words containing 'car' must not trigger Vehicles");

const garbageName = sanitizeBoardName("Fhrhaulsuxbcxzcrviqq Ideas", {
  primaryCategory: "campus life",
  primarySubject: "group of college friends",
  isCampusOrFriends: true,
});
assert.equal(garbageName, "Campus Life / Friends", "Random project-ref board names should be rejected");

const urlName = sanitizeBoardName("https://fhrhaulsuxbcxzcrviqq.supabase.co/storage/v1/object/public/pin-images/foo.jpg", {
  primaryCategory: "music event",
  primarySubject: "concert stage",
  isMusicOrConcert: true,
});
assert.equal(urlName, "Concerts / Music Events", "URL/storage candidate names should be rejected");

const unknownName = sanitizeBoardName("Image Idea", {
  primaryCategory: "other",
  primarySubject: "abstract visual",
});
assert.equal(unknownName, "Visual Inspiration", "Generic Image Idea fallback should become Visual Inspiration");

const reusableConcert = findReusableBoard(
  [{ id: "music-1", name: "Music", description: "Live concerts and festivals", tags: ["concert", "music"] }],
  { name: "Concerts / Music Events", keywords: ["concert", "music", "stage"] },
);
assert.equal(reusableConcert?.id, "music-1", "Second concert save should reuse an existing music/concert board");

const reusableExactConcert = findReusableBoard(
  [{ id: "concert-1", name: "Concerts / Music Events", description: "Live music", tags: ["concert"] }],
  { name: "Concerts / Music Events", keywords: ["concert", "music"] },
);
assert.equal(reusableExactConcert?.id, "concert-1", "Exact category board should be reused before creating another");

const reusableVisual = findReusableBoard(
  [{ id: "visual-1", name: "Visual Inspiration", description: "General visual inspiration", tags: ["visual", "inspiration"] }],
  { name: "Visual Inspiration", keywords: ["visual", "inspiration"] },
);
assert.equal(reusableVisual?.id, "visual-1", "Unknown images should reuse Visual Inspiration once");

const feedbackResult = analyzeImageForBoards({
  boards: [
    { id: "style-board", name: "Style", description: "Outfits and fashion", tags: ["fashion", "style"] },
    { id: "fashion-board", name: "Fashion", description: "Dresses and outfits", tags: ["fashion", "dress"] },
  ],
  pins: [],
  feedback: [
    {
      originalBoardId: "style-board",
      correctedBoardId: "fashion-board",
      imageAnalysis: { title: "red dress", tags: ["fashion", "dress"] },
    },
  ],
  image: {
    primaryCategory: "fashion",
    primarySubject: "red dress outfit",
    detectedObjects: ["dress"],
    detectedTags: ["fashion", "dress"],
    isFashion: true,
  },
});
assert.equal(feedbackResult.predictedBoardId, "fashion-board", "Move feedback should gently boost corrected board");

console.log("Smart Save matching tests passed.");
