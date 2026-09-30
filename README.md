# My Kitchen

A responsive recipe planner built with HTML, CSS, vanilla JavaScript, Node.js, and SQLite.

## Run locally

Use Node.js 24 or newer, then start the included application server:

    node server.js

Open [http://localhost:3000](http://localhost:3000). The server creates `data/my-kitchen.db` on its first run and seeds the 50-recipe catalog. That database is local runtime data and is intentionally excluded from Git.

## Features

- 50 dinner recipes with ingredients, nutrition, and detailed cooking steps
- Server-side recipe search, filters, sorting, and detail records
- SQLite-backed favorites, meal plans, ingredient checks, and cooking-step progress
- An anonymous browser profile so the current UI needs no sign-in flow
- Responsive navigation and image-error fallback

## API

The app serves its API from the same origin:

- `GET /api/recipes` with optional `q`, `category`, `cuisine`, `difficulty`, `time`, and `sort` query parameters
- `GET /api/recipes/:id`
- `GET|PUT|DELETE /api/me/favorites/:recipeId` and `GET /api/me/favorites`
- `GET /api/me/meal-plans/:date` and `PUT /api/me/meal-plans/:date/:mealType`
- `GET|PUT /api/me/recipe-progress/:recipeId`

State endpoints use a browser-generated `X-Client-Id` header. This keeps the existing no-login experience; full user accounts can be layered on later when cross-device identity is needed.

## Verify

    node --test
