# Sparline

Sparline is a Next.js application scaffold for building the Sparline web experience. The project is intentionally small right now: it contains a typed App Router setup, Tailwind CSS styling, the default public assets, and a starter home page that is ready to be replaced with the product UI.

## Tech Stack

- [Next.js](https://nextjs.org/) 16 with the App Router
- [React](https://react.dev/) 19
- [TypeScript](https://www.typescriptlang.org/) with strict mode enabled
- [Tailwind CSS](https://tailwindcss.com/) 4 via PostCSS
- [Bun](https://bun.sh/) lockfile for dependency management

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

## Scripts

```bash
bun dev       # Start the development server
bun run build # Create a production build
bun start     # Start the production server after building
```

## Project Structure

```text
src/app/
  globals.css  Global styles and Tailwind import
  layout.tsx   Root layout, metadata, and font setup
  page.tsx     Home page entry point
public/        Static assets served from the site root
```

## Development Notes

- The current home page is still the generated starter screen. Replace `src/app/page.tsx` when the first real Sparline experience is ready.
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
