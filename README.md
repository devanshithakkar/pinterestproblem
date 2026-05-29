# PinMind - AI Smart Board Organizer

PinMind is a Pinterest-inspired smart organization app for saving visual inspiration without manually choosing a board, writing tags, or describing every image. The app uses Supabase as the source of truth, Express for the API, and a React + Vite + Tailwind frontend.

PinMind now has Supabase Auth for private user data and a real vision-provider architecture. The backend verifies each Supabase access token, then calls OpenAI vision, Gemini vision, or a local mock fallback when no AI API key is configured.

## Product Overview

Users can save an image URL, choose a quick-save demo image, or upload a local file. PinMind analyzes the available image metadata, predicts the best board, and decides what to do:

- High confidence: save automatically to the predicted board.
- Medium confidence: ask the user to confirm or choose another board.
- Low confidence: suggest creating a new board and save there.

Boards build a lightweight visual identity from saved pins, tags, captions, and previous AI prediction signals. Each board can also show recommendation cards that match its saved aesthetic.

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
  "detectedTags": [],
  "objects": [],
  "style": [],
  "colors": [],
  "mood": [],
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

1. Builds an image profile from AI-generated tags, objects, style, colors, mood, and category.
2. Builds board profiles from board name, description, tags, saved pins, and previous AI prediction signals.
3. Scores each board.
4. Returns `auto_save`, `confirm`, or `suggest_new_board`.
5. Refuses to force weak matches into existing boards.

Confidence thresholds:

```text
confidence >= 0.80       auto_save
confidence >= 0.50       confirm
confidence < 0.50        suggest_new_board
```

## API Endpoints

All endpoints below except `/api/health` require `Authorization: Bearer <Supabase access token>`.

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/health` | Backend health check |
| GET | `/api/boards` | Load Supabase boards |
| POST | `/api/boards` | Create a Supabase board |
| GET | `/api/boards/:id` | Load board details, pins, and recommendations |
| GET | `/api/pins` | Load Supabase pins |
| POST | `/api/pins` | Create a Supabase pin |
| PATCH | `/api/pins/:id/board` | Move a pin to another board |
| POST | `/api/uploads/image` | Upload an image to Supabase Storage |
| POST | `/api/predict` | Legacy prediction endpoint |
| POST | `/api/ai/predict-board` | New AI board prediction endpoint |
| POST | `/api/ai/analyze-image` | Run vision analysis and return a board decision |
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

Create a pin:

```bash
curl -sS -X POST "$API_URL/api/pins" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -d '{"boardId":"REPLACE_WITH_BOARD_UUID","title":"Ceramic tea moment","imageUrl":"https://example.com/tea.jpg","caption":"quiet ceramic teapot","tags":["tea","ceramic"]}'
```

## Frontend Test Flow

1. Open `http://localhost:5173`.
2. Confirm logged-out users see the Google login screen and no boards or pins.
3. Sign in with Google.
4. Confirm the user avatar/name appears.
5. Create a board and refresh; it should persist for that user.
6. Upload an image, choose a quick-save image, or paste an image URL.
7. Click `Analyze and organize`.
8. Review the generated title, description, tags, style, and confidence.
9. For high confidence, verify the pin appears immediately in the predicted board.
10. For medium confidence, accept the suggested board or choose another board.
11. For low confidence, create the suggested board and verify the saved pin appears there.
12. Sign out, sign in as another Google user, and confirm the first user's boards are not visible.

## Future Improvements

- Add CLIP/image embeddings for stronger visual similarity.
- Store image embeddings per pin and aggregate board embeddings.
- Add private Storage buckets with signed URLs for stricter image privacy.
- Move to private Supabase Storage buckets with signed URLs.
- Add Pinterest API publishing and import workflows.
- Build a real recommendation engine with feedback loops.
- Add pagination/search for very large boards.
- Add automated route and component tests.
