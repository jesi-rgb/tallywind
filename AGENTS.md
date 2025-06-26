# Agent Guidelines for Tallywind

This is an app that allows coders to count and tally up how many tailwind
classes they're using. It stores data to a database so that we can provide a
global leaderboard of tailwind classes, alongside some other stats.

## Build/Test Commands
- `bun run dev` - Start development server
- `bun run build` - Build for production
- `bun run preview` - Preview production build
- `bun run check` - Type check with svelte-check
- `bun run format` - Format code with Prettier
- `bun run lint` - Check code formatting

## Code Style
- **Formatting**: Uses Prettier with tabs, single quotes, no trailing commas, 100 char width
- **TypeScript**: Strict mode enabled, use proper types for all variables and functions
- **Imports**: Use `$lib/` path alias for library imports, organize imports logically
- **Naming**: camelCase for variables/functions, PascalCase for components/types
- **Database**: Use Drizzle ORM with proper schema types, enable RLS on all tables
- **Svelte**: Use `<script lang="ts">` for TypeScript, bind reactive variables properly
- **CSS**: Use Tailwind CSS classes, DaisyUI components for UI elements
- **Error Handling**: Use try/catch blocks, provide user-friendly error messages

## Architecture
- SvelteKit app with TypeScript
- Database: PostgreSQL with Drizzle ORM
- Styling: Tailwind CSS v4 + DaisyUI
- API routes in `src/routes/api/`
- Components in `src/components/`
- Services in `src/lib/services/`
