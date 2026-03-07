# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal portfolio website hosted on GitHub Pages at https://benguo2003.github.io. Built with Create React App (React 18).

## Development Commands

```bash
npm start          # Dev server
npm run build      # Production build
npm test           # Run tests (Jest, interactive watch mode)
npm run deploy     # Build and deploy to gh-pages branch
```

## Deployment

Deploys to the `gh-pages` branch via the `gh-pages` npm package. The `homepage` in package.json is set to `https://benguo2003.github.io`. Running `npm run deploy` builds and pushes to `gh-pages`.

## Architecture

- Single-page React app (CRA defaults)
- Entry point: `src/index.js` → `src/App.js`
- Static assets (images) imported directly in components from `src/images/`
- ESLint configured via `react-app` and `react-app/jest` presets (in package.json)
