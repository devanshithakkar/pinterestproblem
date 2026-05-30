import assert from "node:assert/strict";
import { analyzeImageForBoards } from "../src/services/aiService.js";

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

console.log("Smart Save matching tests passed.");
