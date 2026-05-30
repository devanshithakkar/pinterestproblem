# PinMind Architecture Audit

Last updated: 2026-05-30

PinMind is an AI visual organization app. The current product lets signed-in users upload, paste, or discover images, then uses backend-only AI analysis to save each image into a user-specific board. Supabase is the source of truth for auth, profile data, boards, pins, and AI metadata. The old JSON file remains as backup/demo data and should not be deleted.

## Current Architecture

PinMind is split into three deployable/operational areas:

- `client/`: React + Vite + Tailwind frontend deployed as the frontend Vercel project.
- `server/`: Express API deployed as the backend Vercel project.
- `supabase/`: database migrations and local Supabase configuration.

Runtime flow:

1. The user signs in with Google through Supabase Auth.
2. The frontend stores only frontend-safe Supabase config and calls the Express API with `Authorization: Bearer <access_token>`.
3. The backend verifies the Supabase token in `server/src/middleware/auth.js`.
4. API routes use `req.user.id` for ownership.
5. Supabase service-role access stays backend-only.
6. Gemini, Pexels, and Unsplash keys stay backend-only.

## Frontend Modules

Main shell:

- `client/src/App.jsx`: auth/session bootstrap, board loading, public profile routing, focus refresh behavior.
- `client/src/pages/BoardApp.jsx`: authenticated app shell, active view state, board detail loading, pin management actions, upload modal, profile settings, mobile navigation.
- `client/src/pages/LandingPage.jsx`: authenticated landing/home screen.
- `client/src/pages/PublicProfilePage.jsx`: `/u/:username` public profile and public board display.

Auth:

- `client/src/components/AuthGate.jsx`: logged-out Google login screen.
- `client/src/lib/supabaseClient.js`: frontend Supabase client using `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- `client/src/lib/api.js`: API helper, `VITE_API_BASE_URL`, defensive JSON parsing, bearer token injection.

Boards and pins:

- `client/src/components/BoardSidebar.jsx`: desktop sidebar board navigation and app sections.
- `client/src/components/BoardCardGrid.jsx`: board overview/cards and visibility controls.
- `client/src/components/CreateBoardModal.jsx`: manual board creation.
- `client/src/components/MasonryGrid.jsx`: saved pin masonry grid.
- `client/src/components/PinCard.jsx`: pin display and pin actions.
- `client/src/components/PinPreviewModal.jsx`: fullscreen saved-image preview.
- `client/src/components/RecommendationStrip.jsx`: board recommendation area.

Smart Save and discovery:

- `client/src/components/UploadModal.jsx`: upload/drop and pasted URL Smart Save flow.
- `client/src/components/ExploreLibrary.jsx`: Pexels/Unsplash image discovery and library Smart Save.
- `client/src/components/ConfidenceBadge.jsx`: confidence/result display.

Profiles and users:

- `client/src/components/ProfileSettingsModal.jsx`: profile editing and public/private profile setting.
- `client/src/components/ExploreUsers.jsx`: public user search/discovery.

Known frontend shape:

- Routing is mostly state/path based inside `App.jsx`, not a formal React Router setup.
- Some board/pin management still uses `window.prompt`/`window.confirm`, which is functional but not polished.
- Mobile support exists, but needs a dedicated audit for touch targets, sheets, and feature parity.

## Backend Modules

Server entry:

- `server/src/index.js`: Express app setup and local `app.listen`.
- `server/api/index.js`: Vercel serverless entry that exports the Express app.
- `server/vercel.json`: backend Vercel routing/config.

Auth and API:

- `server/src/middleware/auth.js`: verifies Supabase bearer tokens.
- `server/src/routes/api.js`: route map and thin request handlers.

Data and storage:

- `server/src/services/databaseService.js`: Supabase CRUD for profiles, boards, pins, AI predictions, public profile queries, and visibility.
- `server/src/services/storageService.js`: Supabase Storage upload/copy helper for images.
- `server/src/db/jsonStore.js`: legacy JSON backup/demo store.
- `server/data/db.json`: backup/demo data only.

AI and Smart Save:

- `server/src/services/visionService.js`: Gemini/OpenAI/mock vision provider normalization.
- `server/src/services/imageInputService.js`: normalizes upload, pasted URL, and library image input; validates pasted external image URLs.
- `server/src/services/boardProfileService.js`: loads user boards, pins, and AI prediction signals.
- `server/src/services/boardMatcherService.js`: wrapper for board compatibility scoring.
- `server/src/services/aiService.js`: core board profile construction, matching, category gates, and recommendation scoring.
- `server/src/services/boardNameService.js`: controlled category board names, sanitizer, board reuse aliases.
- `server/src/services/smartSaveService.js`: orchestrates image analysis, board matching, board reuse/creation, pin creation, and debug output.
- `server/src/services/visualMemoryService.js`: Level 3 visual search, board intelligence profiles, cleanup/merge suggestions, and board-based provider recommendations.

Image libraries:

- `server/src/services/imageLibraryService.js`: Pexels/Unsplash/mock image provider search and normalized image objects.

Scripts:

- `server/scripts/testSmartSaveMatching.js`: regression tests for Smart Save classification and board naming.
- `server/scripts/migrateJsonToSupabase.js`: one-time JSON migration helper.
- `server/scripts/testSupabaseConnection.js`: Supabase connectivity helper.

## API Route Map

Health:

- `GET /api/health`: public health check.

Uploads and Smart Save:

- `POST /api/uploads/image`: upload an image to Supabase Storage.
- `POST /api/ai/smart-save-upload`: legacy upload Smart Save route, now using shared Smart Save orchestration.
- `POST /api/ai/autonomous-save-upload`: upload/drop autonomous Smart Save.
- `POST /api/ai/autonomous-save-url`: pasted direct image URL Smart Save with SSRF and MIME checks.
- `POST /api/ai/autonomous-save`: Explore/library URL Smart Save.
- `POST /api/ai/smart-save`: legacy URL Smart Save route.
- `POST /api/ai/predict-board`: prediction-only compatibility endpoint.
- `POST /api/ai/analyze-image`: image analysis and board decision endpoint.
- `POST /api/ai/auto-save`: older high/medium/low decision route.
- `POST /api/ai/confirm-save`: manual confirmation save route.
- `POST /api/ai/create-board-and-save`: manual create-board-and-save route.
- `POST /api/ai/undo-autonomous-save`: undo route for autonomous save results.

Library:

- `GET /api/library/search?q=&provider=&page=`: Pexels/Unsplash/mock image discovery.

Boards:

- `GET /api/boards`: current user's boards.
- `POST /api/boards`: create board.
- `GET /api/boards/:id`: current user's board with pins/recommendations.
- `GET /api/boards/:id/profile`: current user's board intelligence profile.
- `GET /api/boards/:id/recommendations?page=&provider=`: provider images based on board profile queries.
- `GET /api/boards/cleanup-suggestions`: possible duplicate/similar board merge suggestions.
- `POST /api/boards/merge`: move pins from one owned board into another and delete the source board.
- `PATCH /api/boards/:id`: update board fields.
- `PATCH /api/boards/:id/visibility`: toggle board public/private.
- `DELETE /api/boards/:id`: delete board and its pins.

Pins:

- `GET /api/search/pins?q=&page=&limit=`: natural-language keyword/hybrid search over the current user's saved pins.
- `GET /api/pins`: current user's pins.
- `POST /api/pins`: create pin.
- `PATCH /api/pins/:id`: update pin metadata.
- `PATCH /api/pins/:id/board`: move pin to another owned board.
- `DELETE /api/pins/:id`: delete pin.

Profiles and users:

- `GET /api/me`: current user's profile.
- `PATCH /api/me/profile`: update current user's profile.
- `GET /api/users?q=&page=&limit=`: public user search.
- `GET /api/users/:username`: public profile lookup.
- `GET /api/users/:username/boards`: visible public/owned boards for profile.
- `GET /api/users/:username/boards/:boardId`: visible public/owned board with pins.

Recommendations:

- `GET /api/recommendations/:boardId`: board recommendations using legacy/demo recommendation data plus board context.

## Database Table Map

Defined and evolved through `supabase/migrations`.

`profiles`:

- `id uuid primary key references auth.users(id)`
- `username text unique`
- `display_name text`
- `avatar_url text`
- `bio text`
- `website_url text`
- `location text`
- `interests text[]`
- `profile_visibility text default 'private'`
- `created_at timestamptz`
- `updated_at timestamptz`

`boards`:

- `id uuid primary key`
- `user_id uuid references profiles(id)`
- `name text`
- `description text`
- `tags text[]`
- `aesthetic text`
- `cover_image_url text`
- `visibility text default 'private'`
- `created_at timestamptz`
- `updated_at timestamptz`

`pins`:

- `id uuid primary key`
- `user_id uuid references profiles(id)`
- `board_id uuid references boards(id)`
- `title text`
- `caption text`
- `tags text[]`
- `image_url text`
- `source text`
- `height integer`
- `corrected_at timestamptz`
- `created_at timestamptz`
- `updated_at timestamptz`

`ai_predictions`:

- `id uuid primary key`
- `user_id uuid references profiles(id)`
- `pin_id uuid references pins(id)`
- `predicted_board_id uuid references boards(id)`
- `selected_board_id uuid references boards(id)`
- `confidence integer`
- `signals text[]`
- `alternatives jsonb`
- `scores jsonb`
- `explanation text`
- `input_title text`
- `input_caption text`
- `input_tags text[]`
- `input_file_name text`
- `input_dominant_color text`
- `created_at timestamptz`
- `updated_at timestamptz`

`image_sources`:

- tracks provider/source metadata for saved images, though current route usage appears limited.

`ai_feedback`:

- `id uuid primary key`
- `user_id uuid references profiles(id)`
- `pin_id uuid references pins(id)`
- `original_board_id uuid references boards(id)`
- `corrected_board_id uuid references boards(id)`
- `image_analysis jsonb`
- `created_at timestamptz`
- stores user-specific correction signals when a pin is moved to a different board.

`pinterest_accounts`:

- exists from the initial migration, but Pinterest publishing code was removed later. This table should be treated as legacy until a future publishing design is reintroduced.

RLS/security:

- RLS is enabled on core tables.
- Owners can manage their own profiles, boards, and pins.
- Other authenticated users can read public profiles and public boards/pins only when profile and board visibility allow it.
- Backend still uses the service role key, so route-level auth and `req.user.id` ownership checks remain essential.

## AI Smart Save Pipeline

Shared autonomous flow:

1. `imageInputService` normalizes input from upload, pasted URL, or Explore library.
2. `visionService` sends image bytes/URL to Gemini when configured, otherwise falls back to mock analysis.
3. `boardProfileService` loads the user's boards, pins, and AI prediction signals from Supabase.
4. `boardMatcherService` calls the scoring logic in `aiService`.
5. `aiService` builds board profiles and scores compatibility:
   - primary category and primary subject are strongest;
   - detected objects/tags/style/mood are supporting;
   - colors/environment/background are weak;
   - category mismatch penalties prevent black-hole boards.
6. `boardNameService` maps low-confidence/no-fit images to safe category board names and rejects garbage/random names.
7. `smartSaveService` either saves to a safe existing board or creates/reuses a category board, then saves the pin.

Important reliability rules:

- Nature should not win from weak background words such as `outdoor`, `green`, `trees`, or `natural light`.
- Vehicles should only win when the main subject is a real vehicle.
- Concert, fashion, campus/friends, animal, coding, food, anime, and interior categories have explicit gates and penalties.
- Unsafe names such as `Image Idea`, UUID-like strings, Supabase project refs, storage paths, provider ids, and random `[token] Ideas` are rejected.
- Development responses can include debug info; production responses should not expose noisy internals or secrets.

## Level 3 Visual Memory Layer

Level 3 adds product surfaces around the saved visual memory without introducing embeddings yet:

- AI Visual Search uses `GET /api/search/pins` to search the signed-in user's pins by title, caption, tags, AI prediction signals, and board context.
- Board Intelligence Profiles use `GET /api/boards/:id/profile` to summarize the board's current taste profile, tags, categories, subjects, styles, moods, colors, and recommendation queries. The profile is computed from saved board/pin metadata and AI prediction rows, not by calling Gemini for each request. Owner reads use a short TTL cache, while public reads re-check profile and board visibility server-side.
- Smart Cleanup uses `GET /api/boards/cleanup-suggestions` and `POST /api/boards/merge` to suggest and confirm duplicate-board merges.
- Feedback Learning writes `ai_feedback` rows when pins are moved. Smart Save matching uses feedback as a small user-specific score nudge that is capped below the primary category gates.
- Board-based Recommendations use `GET /api/boards/:id/recommendations` to query Pexels/Unsplash from backend-only provider keys.

Privacy rule: Level 3 search and cleanup routes use `req.user.id` and operate on the signed-in user's rows only. Board Intelligence additionally supports public reads for public boards when the owning profile is public; private board profiles are rejected server-side.

## Known Risks

Product and UX:

- Smart Save is improved but still depends on Gemini quality and non-embedding matching.
- Some management flows still use browser prompts instead of polished modals.
- Explore Users has debounce/stale-response handling, but should be profiled with real user volume.
- Mobile layout exists but needs a complete feature-parity pass.
- Public profile routing is manually handled in `App.jsx`; a router would make nested public board URLs cleaner.

AI/data:

- Matching is lexical/heuristic, not vector embedding based.
- Board profiles are computed from saved pin metadata and AI prediction signals, but not persisted as first-class profile vectors.
- User corrections are learned from moved pins through private `ai_feedback` rows; future passes can add feedback from rename/delete/merge actions.
- Recommendations are still partly legacy/demo oriented.

Backend:

- `server/src/routes/api.js` is much thinner after Smart Save refactor, but it remains a large mixed route file.
- Some old AI routes are kept for compatibility and should be consolidated after frontend usage is verified.
- `image_sources` exists but is not yet a central source-tracking model.
- `pinterest_accounts` remains in the initial schema as legacy history after Pinterest code removal.

Security/privacy:

- Route-level auth is required because the backend uses Supabase admin/service role access.
- Public board/profile behavior depends on both backend ownership checks and RLS; both should be kept aligned.
- Pasted URL handling has SSRF protections, but remote image fetches should continue to use strict timeout/size/content-type limits.

Deployment:

- Frontend and backend are separate Vercel projects from one repo.
- Frontend must only receive `VITE_` public environment variables.
- Backend-only keys include Supabase service role, Gemini, Pexels, Unsplash, and any future provider tokens.

## Recommended Next Phases

Phase 1: Smart Save reliability validation

- Keep expanding regression cases in `server/scripts/testSmartSaveMatching.js`.
- Add a small fixture-based test harness for board naming and matching decisions.
- Log development-only board score explanations for failed manual tests.

Phase 2: UX stabilization

- Replace `window.prompt`/`window.confirm` board and pin management with accessible modals/sheets.
- Complete mobile feature parity for board actions, upload, Explore, People, and profile settings.
- Add consistent toast/result states for all mutations.

Phase 3: Public/private polish

- Verify profile/board visibility from two-account tests.
- Add cleaner public board detail routes.
- Add public/private badges and controls everywhere a board appears.

Phase 4: Search and memory

- Expand natural-language search beyond keyword matching.
- Persist richer AI analysis per pin.
- Add explicit feedback from rename/delete/merge actions, not only moved pins.

Phase 5: Intelligent board profiles and recommendations

- Store board profile summaries/vectors.
- Move from lexical matching to embeddings or hybrid lexical/vector ranking.
- Replace demo recommendations with provider-backed or embedding-backed recommendations.

Phase 6: Browser extension foundation

- Stabilize a backend Smart Save endpoint that accepts page/image metadata from any website.
- Add source attribution and duplicate detection.
- Keep extension auth token handling aligned with Supabase session security.

## Local Test Commands

Backend:

```bash
cd /Users/rishitbanker/pinterestproblem-main/server
npm run dev
```

Frontend:

```bash
cd /Users/rishitbanker/pinterestproblem-main/client
npm run dev
```

Regression checks:

```bash
cd /Users/rishitbanker/pinterestproblem-main/server
npm run test:matching
```

```bash
cd /Users/rishitbanker/pinterestproblem-main/client
npm run build
```
