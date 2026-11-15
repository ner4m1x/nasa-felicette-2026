# AI disclosure

Concept and design decisions by the author. Code written with AI assistance (Anthropic Claude Code);
research, review and planning assisted by Claude and Google Gemini. The Félicette mascot artwork is
AI-assisted. All data values come from cited datasets and publications, not from AI.

## Where AI was used

- **App code** (Next.js / React / TypeScript in `src/`): written with Claude Code, reviewed and directed by the author.
- **Pipeline code** (Python in `scripts/`): written with Claude Code. The pipeline only downloads and
  processes the cited datasets; its scoring config was pre-registered and frozen before the run.
- **Félicette mascot**: an original SVG drawing (`src/components/felicette/FelicetteAvatar.tsx`)
  created with AI assistance. The app shows a small "AI-assisted artwork" caption next to every large
  avatar. The mission patch in the Report is an original SVG made the same way; it is not an official
  mission patch.
- **Copy and translations**: UI text, Félicette's lines and the English/Polish translations were drafted
  with AI assistance and edited by the author.
- **Research, review and planning**: Claude and Google Gemini were used to find and check sources,
  review code and plan the work.

## Where AI was not used

- **Data values.** Every scientific number shown in the app comes from a live API response (NASA POWER),
  a pipeline output file in `public/data/` built from the cited datasets, or a citation in
  `src/data/sources.ts` (DOIs checked against Crossref). The credits are listed in the app under
  **Report → About & credits**.

This project is not affiliated with or endorsed by NASA or ESA, and it shows no NASA or ESA logos, insignia or mission patches.
