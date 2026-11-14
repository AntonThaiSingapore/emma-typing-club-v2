# Emma Typing Club - Ver. 2

Version 2 of the ten-finger typing game, with a Professional level, score saving, and a shared top-three leaderboard. The game is a static HTML/CSS/JavaScript app with a small Vercel serverless API.

## Features

- Six progressive levels, including Professional long-form English passages with mixed case, numbers, punctuation, symbols, and combined Ctrl/Alt/Shift key drills
- Full desktop keyboard and finger guidance, including modifier-key combinations
- Score, accuracy, WPM, timed practice, background scenes, keyboard sounds, and original synthesized pop music
- Save-score dialog that tells players their name, points, and accuracy will be public; nicknames are welcome
- Shared leaderboard that keeps only the top three records, ranked by points and then accuracy
- A short original celebratory jingle and the Creamer Ice-cream message when a saved score beats first place
- Responsive layout and keyboard-accessible dialogs

## Data and privacy

Leaderboard data is stored in a private Vercel Blob store and returned through `/api/leaderboard`. The Blob token is only used by the serverless function and is never sent to the browser. The backend validates names and score values, restricts writes to the site origin, rate-limits submissions per function instance, prevents repeat submissions, and uses conditional Blob writes to avoid overwriting concurrent updates. Only three score records are retained; a nickname is recommended because those records are visible to every visitor.

Browser settings and personal level progress are stored locally on each device. They are separate from the shared leaderboard.

## Run locally

Install dependencies and run with the Vercel CLI so the API routes are available:

```sh
npm install
npx vercel dev
```

Connect a private Vercel Blob store to the local Vercel project and pull its `BLOB_READ_WRITE_TOKEN` into the local environment. Never commit `.env.local` or the Blob token.

## Deploy

The Vercel project is connected to this GitHub repository. Push to `main` to deploy. The project needs the private Blob store connected for shared score saving. No browser-side secrets or public write token are required.

## Credits

The V2 game is based on [AntonThaiSingapore/ten-fingers](https://github.com/AntonThaiSingapore/ten-fingers). Practice text and audio are original; the sound is synthesized in the browser without commercial song recordings.
