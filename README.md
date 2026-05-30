# PinMind - AI Smart Board Organizer

PinMind is a Pinterest-inspired smart organization app for saving visual inspiration without manually choosing a board, writing tags, or describing every image. The app uses Supabase as the source of truth, Express for the API, and a React + Vite + Tailwind frontend.

PinMind now has Supabase Auth for private user data and a real vision-provider architecture. The backend verifies each Supabase access token, then calls OpenAI vision, Gemini vision, or a local mock fallback when no AI API key is configured.

## Product Overview

Users can save an image URL, choose a quick-save demo image, or upload a local file. PinMind analyzes the available image metadata, predicts the best board, and decides what to do:

- High confidence: save automatically to the predicted board.
- Medium confidence: ask the user to confirm or choose another board.
- Low confidence: suggest creating a new board and save there.

Boards build a lightweight visual identity from saved pins, tags, captions, and previous AI prediction signals. Each board can also show recommendation cards that match its saved aesthetic.

## Privacy Policy

See [PRIVACY.md](PRIVACY.md) for the PinMind privacy policy template covering Google login, Supabase storage, AI image analysis, Pexels/Unsplash discovery, and user-scoped data.

## Architecture

```text
pinterestproblem-main/
  client/
    src/
      components/        upload modal, board cards, pin cards, UI pieces
      data/              sample quick-save images
      lib/api.js         frontend API helper with VITE_API_BASE_URL fallback
      lib/supabaseClient.js Supabase Auth client and profile upsert
      pages/             landing page and board app
  server/
    api/index.js         Vercel serverless entrypoint
    data/db.json         backup/demo data only
    src/
      index.js           Express app export plus local app.listen()
      routes/api.js      REST and AI routes
      services/
        databaseService.js  Supabase boards, pins, predictions
        aiService.js        board matching and confidence decision logic
        visionService.js    OpenAI/Gemini/mock image analysis
        storageService.js   Supabase Storage upload helper
```

## Data Source

Supabase Cloud is the single source of truth for active app data:

- `profiles`
- `boards`
- `pins`
- `ai_predictions`
- `image_sources`

`server/data/db.json` is kept only as backup/demo data and should not be deleted.

Users sign in with Google through Supabase Auth. Boards, pins, AI prediction rows, and image source metadata are scoped by the authenticated Supabase user id. Existing rows that belong to the old prototype user remain in place; new users start with their own private data.

Local uploaded images are sent to the backend with multipart upload, then uploaded to a Supabase Storage bucket named `pin-images`. External image URLs continue to work directly.

## Profiles And Privacy

PinMind supports editable user profiles and public/private visibility.

Profile fields:

- `username` is lowercase, unique, and used for `/u/:username` public pages.
- `display_name`, `avatar_url`, `bio`, `website_url`, `location`, and `interests` power the profile page.
- `profile_visibility` is `private` by default and can be changed to `public`.

Board privacy:

- Boards have `visibility`, defaulting to `private`.
- Smart Save-created boards stay private unless the owner changes them later.
- Owners can toggle a board with the `Make Public` / `Make Private` controls on board cards and board details.
- Pins inherit visibility from their board.

Privacy model:

- Owners always see their own profile, boards, and pins.
- Other logged-in users can only see profiles where `profile_visibility = 'public'`.
- Other logged-in users can only see boards where the owner profile is public and the board `visibility = 'public'`.
- Private pins are never returned through public profile routes.
- Frontend hiding is only a convenience; backend routes and Supabase RLS enforce ownership and visibility.

Public profile routes:

- `GET /api/me`
- `PATCH /api/me/profile`
- `GET /api/users?q=&page=`
- `GET /api/users/:username`
- `GET /api/users/:username/boards`
- `GET /api/users/:username/boards/:boardId`
- `PATCH /api/boards/:id/visibility`

Explore Users:

- The People tab lists public profiles only.
- Search is debounced and paginated through `GET /api/users?q=&page=&limit=20`.
- Search responses are ignored if a newer request has already started, which keeps the profile cards and View Profile buttons responsive while typing quickly.

Future profile improvements:

- Avatar uploads with Supabase Storage.
- Follow system.
- Likes and bookmarks.
- Public board sharing links.
- Collaborative boards.

## Auth Flow

1. The frontend creates a Supabase client with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
2. Logged-out users see a login screen and click `Continue with Google`.
3. Supabase returns a session and access token after OAuth.
4. The frontend sends `Authorization: Bearer <access_token>` on protected API requests.
5. The Express backend verifies the token with `supabase.auth.getUser(token)`.
6. API routes use `req.user.id` as `user_id`; they do not trust a frontend-supplied user id.
7. Profiles are upserted from Google metadata with display name and avatar.

## AI Logic

Real/mocked image analysis lives in `server/src/services/visionService.js`; board matching lives in `server/src/services/aiService.js`.

Vision analysis returns a normalized object:

```json
{
  "title": "generated pin title",
  "description": "generated visual description",
  "primarySubject": "main subject, not the background",
  "primaryCategory": "animal|interior|food|fashion|tech|anime|art|other",
  "secondaryCategories": [],
  "detectedObjects": [],
  "detectedTags": [],
  "objects": [],
  "style": [],
  "colors": [],
  "mood": [],
  "environment": "home|outdoors|screen|studio|unknown",
  "isPerson": false,
  "isAnimal": false,
  "isInterior": false,
  "isFood": false,
  "isFashion": false,
  "isTech": false,
  "isAnimeOrIllustration": false,
  "confidenceNotes": "what the model is confident or uncertain about",
  "category": "category",
  "suggestedBoardName": null,
  "reasoning": "why the analysis fits"
}
```

Provider behavior:

1. If `AI_PROVIDER=openai` and `OPENAI_API_KEY` exists, the backend uses OpenAI vision.
2. If `AI_PROVIDER=gemini` and `GEMINI_API_KEY` exists, the backend uses Gemini vision.
3. Otherwise, the backend uses `mockVisionAnalyzer` so local development and Vercel deployments still work without paid AI keys.

After vision analysis, PinMind:

1. Builds an image profile from the primary subject, primary category, tags, objects, style, colors, mood, environment, and boolean visual flags.
2. Builds board profiles from board name, description, tags, saved pins, and previous AI prediction signals.
3. Scores each board with dominant weight for primary category and primary subject, medium weight for detected objects/tags, and tiny supporting weight for style, mood, colors, and environment.
4. Applies mismatch penalties, such as animal vs room decor, food vs tech, anime vs room decor, tech/UI vs fashion, and Nature vs non-nature primary subjects.
5. Returns the top 3 candidate boards with scores and rejection reasoning for debugging.
6. Refuses to force weak matches into existing boards.

Confidence thresholds:

```text
confidence >= 0.82       auto_save
confidence >= 0.60       confirm
confidence < 0.60        suggest_new_board
```

If the best board has a high category mismatch penalty or no strong category/subject overlap, PinMind forces `suggest_new_board` even when one board has the highest weak score.

Nature black-hole prevention:

- Background words such as `outdoor`, `green`, `grass`, `trees`, `sunlight`, `natural light`, `beautiful`, and `photography` are treated as weak context, not primary category evidence.
- A Nature board can only win when the primary subject/category is nature, plants, flowers, landscapes, wildlife, animals, or a compatible travel/nature scene.
- Fashion, concerts/music, campus friends, coding/tech, food, vehicles, anime, and interiors receive category mismatch penalties against Nature even if the photo was taken outside.
- Board size, pin count, first-board order, and recently used boards are not scoring bonuses. They only appear in the UI as metadata.
- Development responses include top board scores, category compatibility, penalties, and rejection reasons so bad matches can be debugged without showing that noisy data to normal users.

Autonomous Smart Save is the default upload flow:

1. The user drops or selects an image.
2. The backend uploads it to Supabase Storage.
3. Gemini analyzes the primary subject and category.
4. PinMind compares the image to the signed-in user's board profiles.
5. If the best board confidence is at least `0.78` and there is no severe mismatch, the pin is saved to that board.
6. Otherwise PinMind creates an AI-named board and saves the pin there.
7. The UI shows Undo, Move, and Rename Board controls after the save instead of asking the user before saving.

Explore Smart Save also uses provider metadata from Pexels/Unsplash, including title, description, and tags. Before creating a board, the backend maps the image into a controlled category board:

- Animals
- Nature
- Anime / Digital Art
- Movies / Cinema
- Fashion
- Coding / Tech
- Room Decor
- Food
- Vehicles
- Fitness / Sports
- Architecture / Travel

Generic suggestions such as `Image Idea`, `Image Ideas`, `Untitled Board`, `New Board`, `Smart Save`, and `Misc` are rejected. PinMind first searches the user's existing boards by normalized name and keyword overlap; if a similar board exists, it reuses it. If no category is clear, it uses `Visual Inspiration` once and reuses that board later.

Board-name safety:

- Board names are never generated from Supabase project refs, storage hostnames, UUIDs, provider ids, file paths, or raw URL segments.
- Random-looking strings such as `Fhrhaulsuxbcxzcrviqq Ideas`, long alphanumeric hashes, UUID-like values, and generic names are rejected by `sanitizeBoardName`.
- Gemini's primary subject/category and boolean flags are prioritized over provider metadata.
- Vehicles is strict: PinMind only chooses `Vehicles` when Gemini marks `isVehicle`, the primary category is vehicle/transportation, or the primary detected object is clearly a car, bike, motorcycle, truck, or bus. Concert and fashion images cannot become Vehicles because of weak metadata.
- Existing boards are reused by exact name, singular/plural normalization, alias groups, and category keyword overlap.

Matching regression test:

```bash
cd server
npm run test:matching
```

This covers the main black-hole cases: a Nature board with several pins must not capture dress, concert, campus friends, or coding images, while flower/forest images should still match Nature.

Undo behavior:

- If the image was saved to an existing board, undo deletes the created pin.
- If PinMind created a new board and saved the pin there, undo deletes the pin and deletes the new board only when it is empty.

Board deletion behavior: deleting a board also deletes pins in that board. PinMind only performs this for boards owned by the signed-in user.

Tab visibility/session handling:

- When the browser tab becomes visible again, the frontend checks the Supabase session first.
- If the session is still valid, it refreshes boards without clearing the current UI first.
- If a refresh fails, the previous boards remain visible and a non-destructive error is shown.
- Boards are only set to an empty list after the API successfully returns an empty list or the user signs out.

## Mobile Support

The app supports desktop and mobile layouts:

- Desktop uses the sidebar plus main workspace.
- Mobile uses a sticky header, compact board menu, and bottom navigation for Boards, Explore, Overview, AI, and Save.
- Upload and board creation dialogs become full-screen mobile sheets.
- Core actions remain reachable on mobile: Explore/search, Smart Save, upload, new board, AI confirmation, create board and save, profile, and logout.
- Masonry grids use 1 column on small phones, 2 columns on larger mobile/tablet, and 3+ columns on desktop.
- Images use lazy loading to reduce mobile bandwidth and layout pressure.
- Saved pin images open in a fullscreen preview modal with object-contain image display, metadata, tags, backdrop close, focused close button, and Escape-key close.

Upload limits:

- Client-side compression attempts to resize large images before upload.
- Images must be under 8MB after compression.
- Only image MIME types are accepted.
- The Smart Save upload request times out after 60 seconds with a clear error.

## API Endpoints

All endpoints below except `/api/health` require `Authorization: Bearer <Supabase access token>`.

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/health` | Backend health check |
| GET | `/api/boards` | Load Supabase boards |
| POST | `/api/boards` | Create a Supabase board |
| GET | `/api/boards/:id` | Load board details, pins, and recommendations |
| PATCH | `/api/boards/:id` | Edit a board owned by the signed-in user |
| DELETE | `/api/boards/:id` | Delete a board and its pins |
| GET | `/api/pins` | Load Supabase pins |
| POST | `/api/pins` | Create a Supabase pin |
| PATCH | `/api/pins/:id` | Edit a pin title, description, or tags |
| DELETE | `/api/pins/:id` | Delete a pin |
| PATCH | `/api/pins/:id/board` | Move a pin to another board |
| POST | `/api/uploads/image` | Upload an image to Supabase Storage |
| POST | `/api/predict` | Legacy prediction endpoint |
| POST | `/api/ai/predict-board` | New AI board prediction endpoint |
| POST | `/api/ai/analyze-image` | Run vision analysis and return a board decision |
| POST | `/api/ai/smart-save` | Autonomous Smart Save from an image URL |
| POST | `/api/ai/autonomous-save` | Autonomous Smart Save from an image URL |
| POST | `/api/ai/autonomous-save-url` | Validate a pasted direct image URL, analyze, auto-place, and save |
| POST | `/api/ai/autonomous-save-upload` | Upload, analyze, auto-place, and save |
| POST | `/api/ai/undo-autonomous-save` | Undo the most recent autonomous save |
| POST | `/api/ai/auto-save` | Predict, then auto-save/confirm/suggest |
| POST | `/api/ai/confirm-save` | Save after a user confirms a board |
| POST | `/api/ai/create-board-and-save` | Create suggested board and save the pin |
| GET | `/api/recommendations/:boardId` | Load board recommendations |

## Environment Variables

Backend, in `server/.env` locally and the backend Vercel project:

```text
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DEV_USER_ID=
ALLOW_DEV_USER_FALLBACK=false
AI_PROVIDER=mock
OPENAI_API_KEY=
GEMINI_API_KEY=
GEMINI_VISION_MODEL=gemini-2.5-flash
PEXELS_API_KEY=
UNSPLASH_ACCESS_KEY=
```

Frontend, in `client/.env` locally and the frontend Vercel project:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_or_publishable_key_here
VITE_API_BASE_URL=http://localhost:4000
```

For production frontend:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_or_publishable_key_here
VITE_API_BASE_URL=https://your-backend-vercel-url
```

Never add `SUPABASE_SERVICE_ROLE_KEY` to the frontend project.
Never add `OPENAI_API_KEY` or `GEMINI_API_KEY` to the frontend project.
Never add `PEXELS_API_KEY` or `UNSPLASH_ACCESS_KEY` to the frontend project.

## Image Library Providers

The Explore library tab searches image providers through the backend route:

```text
GET /api/library/search?q=&page=&provider=
```

Supported providers:

- `provider=pexels`
- `provider=unsplash`
- `provider=all`

Pexels and Unsplash are optional backend-only providers. If a provider key is missing or the provider request fails, PinMind falls back to mock discovery images. The frontend never calls Pexels or Unsplash directly; it only calls the PinMind backend.

## Paste Image URL

The upload modal also supports direct image URLs. Paste a URL such as a `.jpg`, `.png`, `.webp`, or supported `.gif` image and PinMind starts Smart Save automatically:

1. The frontend validates the URL shape.
2. The image preview is loaded when the host allows it.
3. The backend validates the URL again and rejects unsafe protocols, localhost, and private network addresses.
4. The backend fetches the image with a timeout and an 8MB size limit.
5. Gemini analyzes the image bytes.
6. The same autonomous Smart Save logic used by uploads and Explore either saves to a related board or creates a suitable private board.

Some websites block direct image access or provide webpage URLs instead of raw images. In that case PinMind returns a clean error asking for a direct image link.

## Local Setup

Install dependencies:

```bash
npm install
npm run install:all
```

Run both apps:

```bash
npm run dev
```

Or run them separately:

```bash
npm --prefix server run dev
npm --prefix client run dev
```

Local URLs:

```text
Frontend: http://localhost:5173
Backend:  http://localhost:4000
```

Build the frontend:

```bash
npm --prefix client run build
```

## Supabase Setup

1. Create or connect a Supabase project.
2. Apply the SQL migrations in `supabase/migrations/`.
3. Set the backend environment variables listed above.
4. Let the app create the `pin-images` bucket on first local file upload, or create it manually in Supabase Storage.
5. Enable Google as an Auth provider in the Supabase dashboard.

Apply local migrations with Supabase CLI:

```bash
supabase db reset
```

Apply migrations to the linked Supabase Cloud project:

```bash
supabase db push
```

Google OAuth checklist:

- In Google Cloud Console, create an OAuth client for a web app.
- Add the Supabase callback URL to Google: `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`.
- In Supabase Dashboard > Authentication > Providers, enable Google and paste the Google client id and secret.
- In Supabase Dashboard > Authentication > URL Configuration, set Site URL to your frontend URL.
- Add redirect URLs for `http://localhost:5173` and `https://pinmind-frontend.vercel.app`.
- Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the frontend Vercel project.

For local prototype-only API testing without login, set `ALLOW_DEV_USER_FALLBACK=true` and `DEV_USER_ID` in `server/.env`. Keep `ALLOW_DEV_USER_FALLBACK=false` in production.

## Vercel Deployment

Deploy this repo as two Vercel projects.

Backend project:

```text
Project Name: pinmind-api
Root Directory: server
Framework Preset: Other
Install Command: npm install
Build Command: echo "No build step"
Output Directory: leave empty
Environment variables:
  SUPABASE_URL
  SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  ALLOW_DEV_USER_FALLBACK=false
  AI_PROVIDER
  OPENAI_API_KEY
  GEMINI_API_KEY
  GEMINI_VISION_MODEL
  PEXELS_API_KEY
  UNSPLASH_ACCESS_KEY
```

Frontend project:

```text
Project Name: pinmind-frontend
Root Directory: client
Framework Preset: Vite
Install Command: npm install
Build Command: npm run build
Output Directory: dist
Environment variable:
  VITE_API_BASE_URL=https://pinmind-api.vercel.app
  VITE_SUPABASE_URL
  VITE_SUPABASE_ANON_KEY
```

CLI deployment from this machine:

```bash
cd server
npx vercel@latest deploy --prod

cd ../client
npx vercel@latest deploy --prod
```

After deployment:

```bash
curl https://pinmind-api.vercel.app/api/health
curl -i https://pinmind-api.vercel.app/api/boards
```

The second command should return `401` without a Supabase access token.

## Backend Test Commands

Protected API commands require a token:

```bash
export SUPABASE_ACCESS_TOKEN="paste-a-current-user-access-token"
export API_URL="http://localhost:4000"
```

Health check:

```bash
curl -sS "$API_URL/api/health"
```

Boards and pins:

```bash
curl -sS "$API_URL/api/boards" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"

curl -sS "$API_URL/api/pins" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"
```

Search the image library:

```bash
curl -sS "$API_URL/api/library/search?q=desk%20setup&provider=all&page=1" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"
```

Upload an image:

```bash
curl -sS -X POST "$API_URL/api/uploads/image" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -F "image=@/absolute/path/to/image.jpg"
```

Predict without saving:

```bash
curl -sS -X POST "$API_URL/api/ai/analyze-image" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -d '{"imageUrl":"https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80","fileName":"coding-dashboard-laptop-workspace.jpg"}'
```

Auto-save, confirm, or suggest:

```bash
curl -sS -X POST "$API_URL/api/ai/auto-save" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -d '{"imageUrl":"https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80","fileName":"coding-dashboard-laptop-workspace.jpg"}'
```

Autonomous Smart Save from an image URL:

```bash
curl -sS -X POST "$API_URL/api/ai/smart-save" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -d '{"imageUrl":"https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=900&q=80","fileName":"dog-animal-photo.jpg"}'
```

Smart-save an uploaded file:

```bash
curl -sS -X POST "$API_URL/api/ai/autonomous-save-upload" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -F "image=@/absolute/path/to/image.jpg"
```

Smart-save a pasted direct image URL:

```bash
curl -sS -X POST "$API_URL/api/ai/autonomous-save-url" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -d '{"imageUrl":"https://images.pexels.com/photos/414612/pexels-photo-414612.jpeg"}'
```

Invalid webpage URL test:

```bash
curl -sS -X POST "$API_URL/api/ai/autonomous-save-url" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -d '{"imageUrl":"https://www.pinterest.com/pin/example"}'
```

Invalid protocol test:

```bash
curl -sS -X POST "$API_URL/api/ai/autonomous-save-url" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -d '{"imageUrl":"javascript:alert(1)"}'
```

Confirm save:

```bash
curl -sS -X POST "$API_URL/api/ai/confirm-save" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -d '{"imageUrl":"https://example.com/image.jpg","selectedBoardId":"REPLACE_WITH_BOARD_UUID","analysis":{"title":"AI title","description":"AI description","detectedTags":["tag"]},"decision":{"confidence":0.65}}'
```

Create board and save:

```bash
curl -sS -X POST "$API_URL/api/ai/create-board-and-save" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -d '{"imageUrl":"https://example.com/image.jpg","boardName":"Ceramic Ideas","boardDescription":"AI-created board for ceramic inspiration","analysis":{"title":"AI title","description":"AI description","detectedTags":["ceramic","teapot"]},"decision":{"confidence":0.2}}'
```

Create a board:

```bash
curl -sS -X POST "$API_URL/api/boards" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -d '{"name":"Tea Rituals","description":"Ceramic teapots, calm tables, and tea moments","tags":["tea","ceramic","ritual"]}'
```

Edit a board:

```bash
curl -sS -X PATCH "$API_URL/api/boards/REPLACE_WITH_BOARD_UUID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -d '{"name":"Updated Board","description":"Updated description","tags":["updated","keywords"]}'
```

Toggle board visibility:

```bash
curl -sS -X PATCH "$API_URL/api/boards/REPLACE_WITH_BOARD_UUID/visibility" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -d '{"visibility":"public"}'
```

Search public users:

```bash
curl -sS "$API_URL/api/users?q=SEARCH&page=1&limit=20" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"
```

Load a public profile and boards:

```bash
curl -sS "$API_URL/api/users/USERNAME" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"

curl -sS "$API_URL/api/users/USERNAME/boards" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"

curl -sS "$API_URL/api/users/USERNAME/boards/REPLACE_WITH_BOARD_UUID" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"
```

Delete a board and its pins:

```bash
curl -sS -X DELETE "$API_URL/api/boards/REPLACE_WITH_BOARD_UUID" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"
```

Create a pin:

```bash
curl -sS -X POST "$API_URL/api/pins" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -d '{"boardId":"REPLACE_WITH_BOARD_UUID","title":"Ceramic tea moment","imageUrl":"https://example.com/tea.jpg","caption":"quiet ceramic teapot","tags":["tea","ceramic"]}'
```

Edit a pin:

```bash
curl -sS -X PATCH "$API_URL/api/pins/REPLACE_WITH_PIN_UUID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -d '{"title":"Updated pin title","caption":"Updated description","tags":["updated","pin"]}'
```

Move a pin:

```bash
curl -sS -X PATCH "$API_URL/api/pins/REPLACE_WITH_PIN_UUID/board" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -d '{"boardId":"REPLACE_WITH_TARGET_BOARD_UUID"}'
```

Delete a pin:

```bash
curl -sS -X DELETE "$API_URL/api/pins/REPLACE_WITH_PIN_UUID" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"
```

Undo an autonomous save:

```bash
curl -sS -X POST "$API_URL/api/ai/undo-autonomous-save" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -d '{"pinId":"REPLACE_WITH_PIN_UUID","boardId":"REPLACE_WITH_BOARD_UUID","createdNewBoard":true}'
```

## Frontend Test Flow

1. Open `http://localhost:5173`.
2. Confirm logged-out users see the Google login screen and no boards or pins.
3. Sign in with Google.
4. Confirm the user avatar/name appears.
5. Create a board, edit its name/description/tags, refresh, and confirm it persists.
6. Confirm the board is Private by default.
7. Toggle the board to Public from the board card or board detail.
8. Sign out, sign in as another Google user, search User A in People, and confirm only public boards are visible.
9. Toggle the board back to Private as User A and confirm it disappears for User B.
10. Delete a test board and confirm its pins are removed with it.
11. Open a board and edit, move, and delete a pin.
12. Upload an image that matches an existing board and confirm it auto-saves without another click.
13. Upload an unrelated image and confirm PinMind creates a private new board and saves without another click.
14. Paste a direct Pexels image URL and confirm it previews, analyzes automatically, and saves.
15. Paste a second similar direct image URL and confirm the related board is reused.
16. Paste a webpage URL and confirm a clean direct-image error appears.
17. Use Undo after an autonomous save.
18. Use Move after an autonomous save.
19. Rename the newly created board after an autonomous save.
20. Smart Save an animal image from Explore and confirm Animals is created or reused.
21. Smart Save another animal image and confirm the same Animals board is reused.
22. Smart Save a room decor image and confirm Room Decor is used or created.
23. Smart Save a coding image and confirm Coding / Tech is used or created.
24. Smart Save a concert image and confirm Concerts / Music Events is used or created, not Vehicles.
25. Smart Save a dress/fashion image and confirm Fashion is used or created, not Vehicles.
26. Smart Save a campus/friends image and confirm Campus Life / Friends is used or created.
27. Smart Save an unknown image twice and confirm Visual Inspiration is reused.
28. Confirm no new board is created with a random name like `Fhrhaulsuxbcxzcrviqq Ideas`.
29. Click a saved pin image and confirm the fullscreen preview opens.
30. Close the preview with Escape and by clicking the backdrop.
31. Switch to another browser tab, come back, and confirm boards remain visible.
32. In People, type quickly, confirm search does not freeze, and confirm View Profile still navigates.

Mobile checks:

1. Open `http://localhost:5173` in a narrow/mobile viewport.
2. Confirm Google login works and the app waits for auth before showing private boards.
3. Use the bottom nav to open Boards, Explore, Overview, AI, and Save.
4. Search Explore and Smart Save an image.
5. Upload an image and confirm the progress shows Preparing, Uploading, Analyzing, Matching, Saving, and Done.
6. Test an animal image with no pet board; it should suggest a new animal/pet board instead of Room Decor.
7. Test an anime character with no anime board; it should suggest Anime Aesthetic or similar.
8. Test a coding screenshot with a Coding/Tech board; it should save there automatically when confidence is strong enough.
9. Confirm Edit Board, Delete Board, Edit Pin, Move Pin, Delete Pin, Undo, Move, and Rename controls are reachable.
10. Open a pin preview on a mobile viewport and confirm the image uses fullscreen object-contain layout.
11. Refresh and confirm saved data persists.

## Future Improvements

- Add CLIP/image embeddings for stronger visual similarity.
- Store image embeddings per pin and aggregate board embeddings.
- Add private Storage buckets with signed URLs for stricter image privacy.
- Move to private Supabase Storage buckets with signed URLs.
- Build a real recommendation engine with feedback loops.
- Add pagination/search for very large boards.
- Add automated route and component tests.
- Improve user correction learning from post-save Move/Rename actions.

Known limitations:

- Gemini can still misidentify ambiguous images.
- Matching improves as boards accumulate saved pins and AI prediction history.
- Current matching is weighted symbolic scoring; future work should add embeddings/vector similarity for stronger visual understanding.
