# Sparline

Sparline helps people practice scripts out loud.

Think of it like a private practice partner for sales calls, pitches, interviews, role plays, or any conversation you want to get better at. You add a script, split it into practice phases, and run short voice sessions with an AI coach.

The goal is simple: help you say the right words more clearly, with more confidence, before the real conversation happens.

## How It Helps

- Practice out loud instead of only reading notes.
- Break long scripts into smaller phases so practice feels manageable.
- Get live corrections when you miss a phrase or need another try.
- Repeat difficult lines until they feel natural.
- Track sessions, scores, streaks, corrections, and progress over time.
- Review past practice so you can see what is improving.

## Tech Stack

- [Next.js](https://nextjs.org/) 16 with the App Router
- [React](https://react.dev/) 19
- [TypeScript](https://www.typescriptlang.org/) with strict mode enabled
- [Tailwind CSS](https://tailwindcss.com/) 4 via PostCSS
- [Convex](https://www.convex.dev/) for app data and live updates
- [LiveKit](https://livekit.io/) for real-time voice sessions
- [Bun](https://bun.sh/) for dependency management

## Getting Started

Install dependencies:

```bash
bun install
```

Run the local development server:

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

If you are working on features that use Convex, run Convex locally too:

```bash
bun run dev:convex
```

## Scripts

```bash
bun dev            # Start the Next.js development server
bun run dev:convex # Start Convex locally
bun run build      # Create a production build
bun start          # Start the production server after building
```

## Project Structure

```text
src/app/
  (tabs)/       Main app screens: home, scripts, history, progress
  practice/     Voice practice setup and live practice sessions
  globals.css   Global styles and design tokens
  layout.tsx    Root layout, metadata, and providers
convex/         Database schema, queries, mutations, and actions
public/        Static assets served from the site root
```

## Development Notes

- The app currently presents itself in code as `ScriptDrill`, but the repository and README use the project name `Sparline`.
- Global design tokens live in `src/app/globals.css`.
- The `@/*` import alias points to `src/*`.
- No automated test suite or lint script is configured yet.

## Production

Create a production build locally with:

```bash
bun run build
```

After a successful build, run:

```bash
bun start
```

The app can be deployed to any platform that supports Next.js. Vercel is the most direct deployment target for this stack.
