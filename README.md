# SignSpeak — Classroom Accessibility Assistant

A full-stack **Next.js + TypeScript frontend** and **Express + Socket.io backend**. The interface uses a Light Aurora design with responsive layouts, scroll reveals and a simulated landing-page demo.

## Project structure

```text
signspeak/
├── frontend/             # Next.js app, pages, styles, hooks, MediaPipe
│   └── src/
│       ├── app/          # Landing, login, dashboard, room, transcripts
│       ├── components/   # Brand, captions, camera, protected layouts
│       ├── hooks/        # Speech and real-time event hooks
│       ├── lib/          # API client and auth context
│       └── types/
├── backend/              # Express API + authenticated Socket.io server
│   ├── src/              # Routes, auth, persistence, realtime handlers
│   └── data/             # Local database file (created on first run)
├── package.json          # Starts both services with one command
└── README.md
```

## Requirements

- Node.js **20.9+** and npm
- Chrome or Edge for initial Web Speech API testing
- Browser microphone and camera permissions; `localhost` is supported during development
- Internet connection **for initial npm installation, Google font, and MediaPipe model download**

## Setup

1. Open a terminal in the `signspeak` folder.
2. Copy `backend/.env.example` to `backend/.env` and replace `JWT_SECRET` with a strong random secret (at least 32 characters). For example: `openssl rand -hex 32`.
3. Copy `frontend/.env.example` to `frontend/.env.local`.
4. Run the following commands:

```bash
npm install
npm install --prefix backend
npm install --prefix frontend
npm run dev
```

5. Open **http://localhost:3000**. The backend runs on **http://localhost:4000**.
6. Create a teacher account in the app, create a classroom, copy the room code, and sign into a student account (in a separate browser profile or private window) to join.

To run individual services: `npm run dev --prefix backend` and `npm run dev --prefix frontend`.

## Quick manual test

1. Open the landing page. Check hover states, reveal effects, and small-screen layouts.
2. Register a teacher (password at least 8 characters); create a room.
3. Open a private window and register a student. Enter the room code.
4. On the teacher screen, select `English (India)` and click **Start captions**. Allow microphone access. Confirm speech appears on both screens.
5. On the student screen, click **Start camera**, grant permission and try one of the **four demo hand poses**. Confirm the event appears on the teacher screen.
6. End the room and open **Lectures** to search or download its transcript as a `.txt` file.
7. Test keyboard navigation, contrast, text-size controls and `prefers-reduced-motion`.

## What is implemented

- Responsive landing page with scroll-reveal sections, animated demo and code-entry form
- Teacher / student registration and login with bcrypt password hashing and JWT authentication
- Room creation, role checks, six-character codes, and teacher-only room ending
- Socket.io realtime captions, room history, sign events, and unique student counts
- Browser speech recognition in English (India), Hindi, and English (US) when supported
- MediaPipe hand landmark visualization and **four heuristic demo pose labels**
- Searchable transcripts with plain-text export
- Caption size and contrast controls, keyboard focus states, reduced-motion behavior

## Boundaries and important limitations

- **This is a functional development starter, not a completed production deployment.** The code has not been run against real browsers in this environment.
- The four pose labels (`Hello`, `Yes`, `Question`, `Repeat`) are **not verified ASL recognition**. MediaPipe finds landmarks; the app uses orientation-sensitive heuristics. Do not present it as sign-language translation. A labeled dataset, training, evaluation, and broader body/face tracking are future work.
- Speech recognition accuracy varies by browser, microphone, noise, language, and network. Some browsers don't support the Web Speech API.
- The backend stores records in a local JSON file (`backend/data/store.json`). This is convenient for a single-server prototype, **not for multi-instance or high-volume production**. Upgrade to PostgreSQL or another transactional database and use the Redis Socket.io adapter before horizontal scaling.
- Session tokens are held in localStorage for simplicity. Before a public launch, migrate to short-lived sessions or securely configured HTTP-only cookies with CSRF protection as needed.
- Students with any valid account can join a room if they know the code. Add invitation and enrollment policies for sensitive classes.
- The source code does not include PDF export, LLM summaries, full ASL vocabulary, push notifications, instructor analytics, or deployment automation yet. Do not describe those as implemented.
- Camera frames are processed within the browser, but **recognized gesture labels** are sent to the server and saved in the transcript. Add privacy, consent, and retention controls before real classroom usage.
- Browser API access over other devices on a LAN may require HTTPS. For phone testing use a trusted HTTPS dev tunnel or deployed test environment with correctly configured `FRONTEND_ORIGIN` and `NEXT_PUBLIC_API_URL`.
- The backend runs as a **persistent Node.js service**, so host it separately from serverless-only Next.js endpoints. Set the frontend API URL to the backend's public HTTPS URL.

## Next improvements

1. Replace demo sign poses with a validated limited-vocabulary classifier trained on multiple signers.
2. Add PostgreSQL/Prisma migrations, classroom membership and account recovery.
3. Add export to PDF, text-editing permissions, privacy controls and measured caption quality metrics.
4. Add unit/integration tests and Playwright browser workflows before production.
5. Add teacher moderation, better reconnect recovery and realtime event acknowledgments.

## Coding style

Components and hooks are kept separate. Comments explain **why** a piece exists or a non-obvious choice; obvious JSX is intentionally left uncommented. Files are grouped by responsibility, and frontend and backend stay in their own folders.
