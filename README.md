# PinMind - AI Smart Board Organizer

PinMind is a Pinterest-inspired smart board organizer that uses a simple AI recommendation engine to automatically place saved images into the most relevant board.

It is built as an MVP prototype with a polished modern interface, glassmorphism styling, masonry image layouts, AI confidence scores, manual correction, and recommendation panels.

## Project Overview

Users can create boards such as **Fashion**, **Coding**, **Recipes**, and **Room Decor**. When they upload or save an image, PinMind analyzes the image title, caption, tags, filename, and color hint, compares them against board keywords, assigns similarity scores, and auto-selects the best board.

The goal is not production-scale AI. The goal is to simulate a realistic AI-powered Pinterest-style experience with beginner-friendly logic that is easy to understand, modify, and present.

## Inspiration

Pinterest is excellent for visual discovery, but organizing saved content can still feel manual. PinMind explores a smarter workflow:

- Save visual inspiration quickly.
- Let AI suggest the right board.
- Show why the AI made that choice.
- Let the user correct mistakes.
- Improve future predictions with simple learning signals.

## Features

- Create custom boards with descriptions and AI tags
- Upload local images or save image URLs
- Use sample quick-save images for demo testing
- Predict the best board automatically
- Show AI confidence score
- Display matched keyword signals
- Show similarity score for each board
- Manually correct the predicted board
- Store correction history as simulated learning
- View pins in a Pinterest-style masonry grid
- Open each board and see AI recommendations
- Modern AI startup-style UI with glassmorphism
- Sidebar navigation and responsive mobile layout
- Loading skeletons, hover states, and smooth transitions

## Screenshots

Add screenshots here after running the app locally.

Recommended screenshots:

```text
screenshots/
  landing-page.png
  board-dashboard.png
  ai-prediction-modal.png
  recommendations-panel.png
```

Example Markdown:

```md
![Landing Page](screenshots/landing-page.png)
![Board Dashboard](screenshots/board-dashboard.png)
![AI Prediction Modal](screenshots/ai-prediction-modal.png)
```

## Demo

Local demo URLs:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:4000`

Suggested demo flow:

1. Open the landing page.
2. Click **Start organizing**.
3. Open the **Save** modal.
4. Choose a quick-save image.
5. Add or edit image tags.
6. Click **Predict board**.
7. Review the confidence score and board similarity scores.
8. Save the pin.
9. Open the predicted board and view recommendations.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React, Vite |
| Styling | Tailwind CSS |
| Animations | Framer Motion |
| Icons | Lucide React |
| Backend | Node.js, Express |
| Database | Local JSON file |
| AI Logic | Mock keyword similarity engine |

## AI Logic Explanation

PinMind uses a simple recommendation engine in `server/src/services/aiService.js`.

It does not use a real machine learning model. Instead, it follows a transparent scoring process:

1. Read the uploaded image data:
   - title
   - caption
   - tags
   - filename
   - color hint

2. Convert the image data into lowercase keywords.

3. Read every board's data:
   - board name
   - board description
   - board tags
   - aesthetic text
   - previously saved pin captions and tags

4. Convert each board into a keyword list.

5. Compare the image keywords with each board's keywords.

6. Add points:
   - keyword match: adds points
   - official board tag match: adds more points
   - similar saved pins: adds a small boost
   - previous manual corrections: adds a learning boost

7. Sort all boards by score.

8. Auto-select the board with the highest score.

Example:

```text
Image caption:
"coding workspace with laptop and analytics dashboard"

Image tags:
"coding, laptop, dashboard"

Coding board keywords:
coding, developer, laptop, terminal, dashboard, interface, workspace

Result:
Coding receives the highest similarity score and is selected automatically.
```

The UI shows:

- predicted board
- AI confidence score
- matched signals
- similarity score for every board

## Project Structure

```text
smart-board-organizer/
  client/
    src/
      components/        reusable React components
      data/              sample quick-save image data
      lib/               frontend API helper
      pages/             landing page and app dashboard
      styles/            global Tailwind styles
  server/
    data/db.json         local JSON database
    src/
      db/                JSON read/write helpers
      routes/            Express API routes
      services/          AI scoring and recommendation logic
      utils/             ID helper
```

## Setup Instructions

Clone or open the project folder:

```bash
cd C:\Users\Devanshi\Documents\Codex
cd smart-board-organizer
```

Install dependencies:

```bash
npm install
npm run install:all
```

Run the full app:

```bash
npm run dev
```

Open the frontend:

```text
http://localhost:5173
```

The backend runs at:

```text
http://localhost:4000
```

Build the frontend:

```bash
npm run build
```

## API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/boards` | Get all boards |
| POST | `/api/boards` | Create a board |
| GET | `/api/boards/:id` | Get board details, pins, and recommendations |
| POST | `/api/predict` | Predict the best board for an image |
| POST | `/api/pins` | Save a pin |
| PATCH | `/api/pins/:id/board` | Move a pin and record correction learning |
| GET | `/api/recommendations/:boardId` | Get recommendations for a board |

## Future Roadmap

- Add authentication and user-specific boards
- Replace mock logic with a real vision-language AI model
- Add embeddings for stronger recommendation matching
- Store uploaded images in Cloudinary, Firebase Storage, or S3
- Add drag-and-drop pin organization
- Add search and filtering across boards
- Add board sharing and collaboration
- Add dark mode
- Add automated tests for API routes and scoring logic
- Deploy frontend and backend to cloud services

## Status

MVP prototype complete. The app is designed for learning, demos, and portfolio presentation.
