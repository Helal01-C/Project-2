'use strict';

const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { createApp } = require('../server');

const CLIENT_A = 'test-client-alpha';
const CLIENT_B = 'test-client-bravo';

async function startTestServer(t) {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'my-kitchen-api-'));
  const app = createApp({ databasePath: path.join(temporaryDirectory, 'test.sqlite') });

  await new Promise((resolve, reject) => {
    app.server.once('error', reject);
    app.server.listen(0, '127.0.0.1', resolve);
  });

  const address = app.server.address();
  assert.equal(typeof address, 'object');
  assert.ok(address && typeof address.port === 'number');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  t.after(async () => {
    app.server.closeAllConnections();
    await new Promise((resolve, reject) => {
      app.server.close(error => (error ? reject(error) : resolve()));
    });
    app.close();
    await rm(temporaryDirectory, { recursive: true, force: true });
  });

  return baseUrl;
}

async function api(baseUrl, endpoint, options = {}) {
  const response = await fetch(baseUrl + endpoint, options);
  return { response, body: await response.json() };
}

function jsonRequest(method, body, clientId = CLIENT_A) {
  return {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Id': clientId,
    },
    body: JSON.stringify(body),
  };
}

test('health reports the API service is ready', async t => {
  const baseUrl = await startTestServer(t);
  const { response, body } = await api(baseUrl, '/api/health');

  assert.equal(response.status, 200);
  assert.deepEqual(body, {
    data: { status: 'ok', service: 'my-kitchen-api' },
  });
});

test('recipes are seeded, filterable, sortable, and available by detail id', async t => {
  const baseUrl = await startTestServer(t);

  const allRecipes = await api(baseUrl, '/api/recipes');
  assert.equal(allRecipes.response.status, 200);
  assert.equal(allRecipes.body.meta.total, 50);
  assert.equal(allRecipes.body.data.length, 50);
  assert.ok(allRecipes.body.data.some(recipe => recipe.name === 'Chicken Biryani'));
  assert.ok(allRecipes.body.data.some(recipe => recipe.name === 'Coconut Lentil Dal'));

  const filtered = await api(
    baseUrl,
    '/api/recipes?category=Vegetarian&cuisine=Indian&difficulty=Easy&time=30to60&sort=alpha',
  );
  assert.equal(filtered.response.status, 200);
  assert.deepEqual(filtered.body.data.map(recipe => recipe.name), [
    'Chickpea Curry',
    'Coconut Lentil Dal',
    'Vegetable Curry',
  ]);
  assert.ok(filtered.body.data.every(recipe => recipe.totalTime >= 30 && recipe.totalTime <= 60));

  const detail = await api(baseUrl, '/api/recipes/1');
  assert.equal(detail.response.status, 200);
  assert.equal(detail.body.data.id, 1);
  assert.equal(detail.body.data.name, 'Chicken Biryani');
  assert.ok(detail.body.data.ingredients.length > 0);
  assert.ok(detail.body.data.steps.length > 0);
  assert.equal(typeof detail.body.data.nutrition.calories, 'string');
});

test('favorites persist per X-Client-Id and can be removed', async t => {
  const baseUrl = await startTestServer(t);
  const clientAHeaders = { 'X-Client-Id': CLIENT_A };
  const clientBHeaders = { 'X-Client-Id': CLIENT_B };

  const initial = await api(baseUrl, '/api/me/favorites', { headers: clientAHeaders });
  assert.equal(initial.response.status, 200);
  assert.deepEqual(initial.body.data, []);

  const added = await api(baseUrl, '/api/me/favorites/1', {
    method: 'PUT',
    headers: clientAHeaders,
  });
  assert.equal(added.response.status, 200);
  assert.deepEqual(added.body.data, [1]);

  const addedAgain = await api(baseUrl, '/api/me/favorites/1', {
    method: 'PUT',
    headers: clientAHeaders,
  });
  assert.deepEqual(addedAgain.body.data, [1]);

  const otherClient = await api(baseUrl, '/api/me/favorites', { headers: clientBHeaders });
  assert.equal(otherClient.response.status, 200);
  assert.deepEqual(otherClient.body.data, []);

  const removed = await api(baseUrl, '/api/me/favorites/1', {
    method: 'DELETE',
    headers: clientAHeaders,
  });
  assert.equal(removed.response.status, 200);
  assert.deepEqual(removed.body.data, []);
});

test('meal plans save and read back for the same client and date', async t => {
  const baseUrl = await startTestServer(t);
  const meal = {
    name: 'Weeknight curry',
    time: 35,
    servings: 2,
    description: 'Serve with basmati rice.',
    status: 'Completed',
  };

  const saved = await api(
    baseUrl,
    '/api/me/meal-plans/2026-09-14/Dinner',
    jsonRequest('PUT', meal, CLIENT_A),
  );
  assert.equal(saved.response.status, 200);
  assert.deepEqual(saved.body.data, meal);

  const loaded = await api(baseUrl, '/api/me/meal-plans/2026-09-14', {
    headers: { 'X-Client-Id': CLIENT_A },
  });
  assert.equal(loaded.response.status, 200);
  assert.deepEqual(loaded.body.data, { Dinner: meal });

  const otherClient = await api(baseUrl, '/api/me/meal-plans/2026-09-14', {
    headers: { 'X-Client-Id': CLIENT_B },
  });
  assert.deepEqual(otherClient.body.data, {});
});

test('recipe progress normalizes and persists selected ingredient and step indices', async t => {
  const baseUrl = await startTestServer(t);
  const headers = { 'X-Client-Id': CLIENT_A };

  const initial = await api(baseUrl, '/api/me/recipe-progress/1', { headers });
  assert.equal(initial.response.status, 200);
  assert.deepEqual(initial.body.data, { ingredients: [], steps: [] });

  const saved = await api(
    baseUrl,
    '/api/me/recipe-progress/1',
    jsonRequest('PUT', { ingredients: [3, 0, 3], steps: [1] }),
  );
  assert.equal(saved.response.status, 200);
  assert.deepEqual(saved.body.data, { ingredients: [0, 3], steps: [1] });

  const loaded = await api(baseUrl, '/api/me/recipe-progress/1', { headers });
  assert.equal(loaded.response.status, 200);
  assert.deepEqual(loaded.body.data, { ingredients: [0, 3], steps: [1] });
});

test('API rejects invalid requests and returns not-found responses', async t => {
  const baseUrl = await startTestServer(t);

  const noClientId = await api(baseUrl, '/api/me/favorites');
  assert.equal(noClientId.response.status, 400);
  assert.match(noClientId.body.error.message, /X-Client-Id/);

  const invalidFilter = await api(baseUrl, '/api/recipes?sort=unsupported');
  assert.equal(invalidFilter.response.status, 400);
  assert.match(invalidFilter.body.error.message, /Unsupported sort/);

  const missingRecipe = await api(baseUrl, '/api/recipes/999999');
  assert.equal(missingRecipe.response.status, 404);
  assert.match(missingRecipe.body.error.message, /Recipe not found/);

  const invalidProgress = await api(
    baseUrl,
    '/api/me/recipe-progress/1',
    jsonRequest('PUT', { ingredients: [-1], steps: [] }),
  );
  assert.equal(invalidProgress.response.status, 400);
  assert.match(invalidProgress.body.error.message, /invalid index/);

  const missingRoute = await api(baseUrl, '/api/not-a-route');
  assert.equal(missingRoute.response.status, 404);
  assert.match(missingRoute.body.error.message, /route not found/);
});
