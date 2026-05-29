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
        pinterestService.js Pinterest publishing helper
```

## Data Source

Supabase Cloud is the single source of truth for active app data:

- `profiles`
- `boards`
- `pins`
- `ai_predictions`
- `image_sources`
- `pinterest_accounts`

`server/data/db.json` is kept only as backup/demo data and should not be deleted.

Users sign in with Google through Supabase Auth. Boards, pins, AI prediction rows, and image source metadata are scoped by the authenticated Supabase user id. Existing rows that belong to the old prototype user remain in place; new users start with their own private data.

Local uploaded images are sent to the backend with multipart upload, then uploaded to a Supabase Storage bucket named `pin-images`. External image URLs continue to work directly.

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
3. Scores each board with high weight for primary category and subject, medium weight for detected tags/style/mood, and low weight for colors.
4. Applies mismatch penalties, such as animal vs room decor, food vs tech, anime vs room decor, and tech/UI vs fashion.
5. Returns the top 3 candidate boards with scores and rejection reasoning for debugging.
6. Refuses to force weak matches into existing boards.

Confidence thresholds:

```text
confidence >= 0.82       auto_save
confidence >= 0.60       confirm
confidence < 0.60        suggest_new_board
```

If the best board has a high category mismatch penalty or no strong category/subject overlap, PinMind forces `suggest_new_board` even when one board has the highest weak score.

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
| POST | `/api/ai/autonomous-save-upload` | Upload, analyze, auto-place, and save |
| POST | `/api/ai/undo-autonomous-save` | Undo the most recent autonomous save |
| POST | `/api/ai/auto-save` | Predict, then auto-save/confirm/suggest |
| POST | `/api/ai/confirm-save` | Save after a user confirms a board |
| POST | `/api/ai/create-board-and-save` | Create suggested board and save the pin |
| GET | `/api/recommendations/:boardId` | Load board recommendations |
| GET | `/api/pinterest/status` | Check whether backend Pinterest publishing is configured |
| PATCH | `/api/boards/:boardId/pinterest` | Save a Pinterest Board ID for a PinMind board |
| POST | `/api/pinterest/publish/:pinId` | Publish a saved PinMind pin to Pinterest |

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
PINTEREST_ACCESS_TOKEN=
PINTEREST_API_BASE=https://api.pinterest.com/v5
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
Never add `PINTEREST_ACCESS_TOKEN` to the frontend project.

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

## Pinterest Publishing

Pinterest publishing is optional and backend-only. Put the Pinterest token in `server/.env` for local development and in the backend Vercel project for production:

```text
PINTEREST_ACCESS_TOKEN=
PINTEREST_API_BASE=https://api.pinterest.com/v5
```

Do not put the token in `client/.env`, Vite variables, frontend code, or any public repository file.

The Pinterest app/token needs permission to create pins. Use `pins:write`; add `boards:read` if you later build a Pinterest board picker or validator.

Publishing flow:

1. Open a PinMind board.
2. Paste the matching Pinterest Board ID into the `Pinterest Board ID` field.
3. Save the board setting.
4. Use `Publish to Pinterest` on a saved pin card.

If `PINTEREST_ACCESS_TOKEN` is missing, PinMind keeps working normally and the UI shows Pinterest publishing as disabled.

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
  PINTEREST_ACCESS_TOKEN
  PINTEREST_API_BASE
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

Save a Pinterest Board ID to a PinMind board:

```bash
curl -sS -X PATCH "$API_URL/api/boards/REPLACE_WITH_BOARD_UUID/pinterest" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -d '{"pinterestBoardId":"REPLACE_WITH_PINTEREST_BOARD_ID"}'
```

Publish a saved PinMind pin to Pinterest:

```bash
curl -sS -X POST "$API_URL/api/pinterest/publish/REPLACE_WITH_PIN_UUID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -d '{}'
```

## Frontend Test Flow

1. Open `http://localhost:5173`.
2. Confirm logged-out users see the Google login screen and no boards or pins.
3. Sign in with Google.
4. Confirm the user avatar/name appears.
5. Create a board, edit its name/description/tags, refresh, and confirm it persists.
6. Delete a test board and confirm its pins are removed with it.
7. Open a board and edit, move, and delete a pin.
8. Upload an image that matches an existing board and confirm it auto-saves without another click.
9. Upload an unrelated image and confirm PinMind creates a new board and saves without another click.
10. Use Undo after an autonomous save.
11. Use Move after an autonomous save.
12. Rename the newly created board after an autonomous save.
13. Smart Save an animal image from Explore and confirm Animals is created or reused.
14. Smart Save another animal image and confirm the same Animals board is reused.
15. Smart Save a room decor image and confirm Room Decor is used or created.
16. Smart Save a coding image and confirm Coding / Tech is used or created.
17. Click a saved pin image and confirm the fullscreen preview opens.
18. Close the preview with Escape and by clicking the backdrop.
19. Switch to another browser tab, come back, and confirm boards remain visible.
20. Sign out, sign in as another Google user, and confirm the first user's boards are not visible.
21. Add a Pinterest Board ID to a board and publish one saved pin.

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
- Add Pinterest board import and picker workflows.
- Build a real recommendation engine with feedback loops.
- Add pagination/search for very large boards.
- Add automated route and component tests.
- Improve user correction learning from post-save Move/Rename actions.

Known limitations:

- Gemini can still misidentify ambiguous images.
- Matching improves as boards accumulate saved pins and AI prediction history.
- Current matching is weighted symbolic scoring; future work should add embeddings/vector similarity for stronger visual understanding.
