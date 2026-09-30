'use strict';

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { URL } = require('node:url');
const { DatabaseSync } = require('node:sqlite');

const ROOT_DIRECTORY = __dirname;
const DATA_DIRECTORY = path.join(ROOT_DIRECTORY, 'data');
const DEFAULT_DATABASE_PATH = path.join(DATA_DIRECTORY, 'my-kitchen.db');
const DEFAULT_PORT = Number(process.env.PORT || 3000);
const MAX_BODY_BYTES = 1000000;
const MEAL_TYPES = new Set(['Breakfast', 'Lunch', 'Dinner']);

const EXTRA_RECIPES = [
  ['Lamb Rogan Josh', 'Beef', 'Indian', 25, 70, 95, 4],
  ['Chicken Shawarma Bowls', 'Chicken', 'Middle Eastern', 25, 25, 50, 4],
  ['Thai Green Curry', 'Chicken', 'Thai', 20, 25, 45, 4],
  ['Teriyaki Chicken', 'Chicken', 'Japanese', 15, 20, 35, 4],
  ['Moroccan Chickpea Tagine', 'Vegetarian', 'Moroccan', 20, 40, 60, 4],
  ['Mushroom Risotto', 'Rice', 'Italian', 15, 35, 50, 4],
  ['Pesto Gnocchi', 'Pasta', 'Italian', 10, 15, 25, 4],
  ['Eggplant Parmesan', 'Vegetarian', 'Italian', 25, 40, 65, 4],
  ['Korean Beef Bowls', 'Beef', 'Korean', 15, 20, 35, 4],
  ['Lemon Herb Cod', 'Fish', 'Mediterranean', 10, 20, 30, 4],
  ['Jambalaya', 'Seafood', 'Creole', 20, 40, 60, 6],
  ['Turkey Meatballs', 'Chicken', 'Italian', 20, 30, 50, 4],
  ['Tofu Pad Thai', 'Vegetarian', 'Thai', 20, 20, 40, 4],
  ['Black Bean Enchiladas', 'Vegetarian', 'Mexican', 20, 30, 50, 4],
  ['Coconut Lentil Dal', 'Vegetarian', 'Indian', 15, 35, 50, 4],
  ['Honey Garlic Salmon', 'Fish', 'Asian', 10, 18, 28, 4],
  ['Mediterranean Orzo', 'Pasta', 'Mediterranean', 15, 20, 35, 4],
  ['Szechuan Noodles', 'Pasta', 'Chinese', 15, 20, 35, 4],
  ['Stuffed Bell Peppers', 'Vegetarian', 'American', 20, 40, 60, 4],
  ['BBQ Chicken Pizza', 'Chicken', 'American', 20, 20, 40, 4],
];

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function now() {
  return new Date().toISOString();
}

function valueOrFallback(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function createRecipeDetails(recipe) {
  const name = recipe.name.toLowerCase();
  const isVegetarian = recipe.category === 'Vegetarian';
  const protein = isVegetarian
    ? 'mixed vegetables and chickpeas'
    : recipe.category === 'Fish'
      ? 'white fish'
      : recipe.category === 'Seafood'
        ? 'seafood'
        : recipe.category === 'Beef'
          ? 'beef'
          : recipe.category === 'Pasta'
            ? 'pasta'
            : recipe.category.toLowerCase();
  const common = [
    { name: 'Salt', quantity: '¾', unit: 'tsp', group: 'Seasoning' },
    { name: 'Black pepper', quantity: '½', unit: 'tsp', group: 'Seasoning' },
    { name: 'Cooking oil', quantity: '1', unit: 'tbsp', group: 'Seasoning' },
  ];
  let ingredients;
  let steps;

  if (name.includes('biryani')) {
    ingredients = [
      { name: name.includes('beef') ? 'Beef, cubed' : 'Chicken, bone-in pieces', quantity: '750', unit: 'g', group: 'Main' },
      { name: 'Basmati rice', quantity: '500', unit: 'g', group: 'Main' },
      { name: 'Plain yogurt', quantity: '120', unit: 'g', group: 'Main' },
      { name: 'Onion, thinly sliced', quantity: '3', unit: 'large', group: 'Aromatics & spices' },
      { name: 'Ginger-garlic paste', quantity: '2', unit: 'tbsp', group: 'Aromatics & spices' },
      { name: 'Biryani masala', quantity: '2', unit: 'tbsp', group: 'Aromatics & spices' },
      { name: 'Saffron milk', quantity: '60', unit: 'ml', group: 'Aromatics & spices' },
      ...common,
    ];
    steps = [
      ['Marinate', 'Combine the meat, yogurt, ginger-garlic paste, biryani masala, and salt; rest for 20 minutes.'],
      ['Par-cook rice', 'Rinse rice and boil in salted water until about 70% cooked; drain well.'],
      ['Cook meat', 'Fry onions until deep golden, add marinated meat, and cook until the sauce is thick.'],
      ['Layer and steam', 'Layer rice over meat, drizzle saffron milk, cover tightly, and steam on low heat until tender.'],
    ];
  } else if (name.includes('curry') || name.includes('rogan') || name.includes('tagine') || name.includes('dal')) {
    const main = name.includes('chickpea')
      ? 'Cooked chickpeas'
      : name.includes('lentil') || name.includes('dal')
        ? 'Red lentils'
        : name.includes('paneer')
          ? 'Paneer'
          : name.includes('vegetable')
            ? 'Mixed vegetables'
            : name.includes('shrimp')
              ? 'Raw shrimp'
              : name.includes('fish')
                ? 'Firm white fish'
                : name.includes('lamb')
                  ? 'Lamb shoulder'
                  : 'Chicken thigh';
    ingredients = [
      { name: main, quantity: '600', unit: 'g', group: 'Main' },
      { name: 'Onion, diced', quantity: '2', unit: 'large', group: 'Main' },
      { name: 'Tomatoes, chopped', quantity: '400', unit: 'g', group: 'Main' },
      { name: 'Coconut milk or water', quantity: '400', unit: 'ml', group: 'Main' },
      { name: 'Garlic, minced', quantity: '4', unit: 'cloves', group: 'Spices' },
      { name: 'Fresh ginger, grated', quantity: '1', unit: 'tbsp', group: 'Spices' },
      { name: 'Ground turmeric', quantity: '1', unit: 'tsp', group: 'Spices' },
      { name: 'Garam masala or curry powder', quantity: '2', unit: 'tsp', group: 'Spices' },
      ...common,
    ];
    steps = [
      ['Build the base', 'Cook onion in oil until soft and golden. Stir in ginger, garlic, and spices for 30 seconds.'],
      ['Make the sauce', 'Add tomatoes and cook until they break down into a thick, fragrant sauce.'],
      ['Simmer', 'Add the main ingredient and liquid; simmer gently until tender.'],
      ['Finish', 'Taste for salt, stir through fresh herbs if available, and serve with rice or flatbread.'],
    ];
  } else if (name.includes('pasta') || name.includes('alfredo') || name.includes('bolognese') || name.includes('gnocchi') || name.includes('orzo') || name.includes('noodles')) {
    ingredients = [
      { name: name.includes('gnocchi') ? 'Potato gnocchi' : name.includes('orzo') ? 'Orzo' : 'Pasta or noodles', quantity: '350', unit: 'g', group: 'Pasta' },
      { name: 'Olive oil', quantity: '1', unit: 'tbsp', group: 'Pasta' },
      { name: 'Garlic, sliced', quantity: '3', unit: 'cloves', group: 'Pasta' },
      { name: name.includes('alfredo') || name.includes('creamy') ? 'Heavy cream' : 'Crushed tomatoes or stir-fry sauce', quantity: '300', unit: 'ml', group: 'Sauce' },
      { name: 'Parmesan or hard cheese', quantity: '60', unit: 'g', group: 'Sauce' },
      { name: 'Fresh herbs or vegetables', quantity: '150', unit: 'g', group: 'Sauce' },
      ...common,
    ];
    steps = [
      ['Boil pasta', 'Cook the pasta in well-salted water until just al dente; reserve a cup of cooking water.'],
      ['Prepare sauce', 'Cook garlic gently in oil, then add the sauce ingredients and simmer until glossy.'],
      ['Toss', 'Add pasta and a splash of reserved water; toss until every piece is coated.'],
      ['Serve', 'Season to taste and finish with cheese, herbs, or lemon as appropriate.'],
    ];
  } else {
    const main = name.includes('salmon')
      ? 'Salmon fillets'
      : name.includes('fish') || name.includes('cod')
        ? 'White fish fillets'
        : name.includes('shrimp') || name.includes('seafood')
          ? 'Raw shrimp or mixed seafood'
          : name.includes('beef') || name.includes('steak')
            ? 'Beef'
            : name.includes('tofu')
              ? 'Firm tofu'
              : name.includes('vegetable')
                ? 'Mixed vegetables'
                : 'Chicken';
    ingredients = [
      { name: main, quantity: '600', unit: 'g', group: 'Main' },
      { name: 'Fresh vegetables', quantity: '300', unit: 'g', group: 'Main' },
      { name: 'Garlic, minced', quantity: '3', unit: 'cloves', group: 'Flavour' },
      { name: 'Lemon, lime, or vinegar', quantity: '1', unit: 'tbsp', group: 'Flavour' },
      { name: 'Fresh herbs or sauce', quantity: '2', unit: 'tbsp', group: 'Flavour' },
      ...common,
    ];
    steps = [
      ['Prepare', 'Pat the main ingredient dry and season it with salt, pepper, garlic, and the flavourings.'],
      ['Cook', 'Use a hot pan, grill, or oven and cook until browned and safely cooked through.'],
      ['Add vegetables', 'Cook the vegetables separately until crisp-tender, then combine with the main ingredient.'],
      ['Finish', 'Rest briefly, adjust seasoning, and serve immediately.'],
    ];
  }

  const stepTime = Math.max(5, Math.round(recipe.totalTime / 4));
  const calorieBase = recipe.category === 'Vegetarian' ? 440 : recipe.category === 'Seafood' || recipe.category === 'Fish' ? 470 : 520;
  return {
    ...recipe,
    description: valueOrFallback(recipe.description, 'A home-style ' + recipe.cuisine + ' ' + recipe.name.toLowerCase() + ' made for a relaxed dinner.'),
    image: valueOrFallback(recipe.image, 'https://loremflickr.com/1200/800/' + encodeURIComponent(recipe.name) + ',food?lock=' + recipe.id),
    ingredients: recipe.ingredients || ingredients,
    steps: recipe.steps || steps.map(([title, description]) => ({ title, time: stepTime + ' min', description })),
    nutrition: recipe.nutrition || {
      calories: '~' + calorieBase + ' kcal',
      protein: isVegetarian ? '~16 g' : '~28 g',
      carbs: '~48 g',
      fat: '~20 g',
    },
    nutritionNote: 'Estimated per serving; values vary with brands and portions.',
  };
}

function loadSeedRecipes() {
  const recipePath = path.join(DATA_DIRECTORY, 'recipes.json');
  const baseRecipes = JSON.parse(fs.readFileSync(recipePath, 'utf8'));
  const generatedRecipes = EXTRA_RECIPES.map(([name, category, cuisine, prepTime, cookTime, totalTime, servings], index) => ({
    id: index + 31,
    name,
    category,
    cuisine,
    difficulty: totalTime > 60 ? 'Medium' : 'Easy',
    prepTime,
    cookTime,
    totalTime,
    servings,
    rating: 4.5,
    popularity: 60 + index,
  }));
  return [...baseRecipes, ...generatedRecipes].map(createRecipeDetails);
}

function initialiseDatabase(database) {
  database.exec([
    'PRAGMA foreign_keys = ON;',
    'CREATE TABLE IF NOT EXISTS recipes (',
    '  id INTEGER PRIMARY KEY,',
    '  name TEXT NOT NULL,',
    '  category TEXT NOT NULL,',
    '  cuisine TEXT NOT NULL,',
    '  difficulty TEXT NOT NULL,',
    '  prep_time INTEGER NOT NULL,',
    '  cook_time INTEGER NOT NULL,',
    '  total_time INTEGER NOT NULL,',
    '  servings INTEGER NOT NULL,',
    '  rating REAL NOT NULL,',
    '  popularity INTEGER NOT NULL,',
    '  description TEXT NOT NULL,',
    '  image TEXT NOT NULL,',
    '  ingredients_json TEXT NOT NULL,',
    '  steps_json TEXT NOT NULL,',
    '  nutrition_json TEXT NOT NULL,',
    '  nutrition_note TEXT NOT NULL',
    ');',
    'CREATE TABLE IF NOT EXISTS profiles (',
    '  id TEXT PRIMARY KEY,',
    '  created_at TEXT NOT NULL',
    ');',
    'CREATE TABLE IF NOT EXISTS favorites (',
    '  profile_id TEXT NOT NULL,',
    '  recipe_id INTEGER NOT NULL,',
    '  created_at TEXT NOT NULL,',
    '  PRIMARY KEY (profile_id, recipe_id),',
    '  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,',
    '  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE',
    ');',
    'CREATE TABLE IF NOT EXISTS meal_plans (',
    '  profile_id TEXT NOT NULL,',
    '  plan_date TEXT NOT NULL,',
    '  meal_type TEXT NOT NULL CHECK (meal_type IN (\'Breakfast\', \'Lunch\', \'Dinner\')),',
    '  name TEXT NOT NULL,',
    '  time_minutes INTEGER NOT NULL,',
    '  servings INTEGER NOT NULL,',
    '  description TEXT NOT NULL,',
    '  status TEXT NOT NULL CHECK (status IN (\'Planned\', \'Completed\')),',
    '  updated_at TEXT NOT NULL,',
    '  PRIMARY KEY (profile_id, plan_date, meal_type),',
    '  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE',
    ');',
    'CREATE TABLE IF NOT EXISTS recipe_progress (',
    '  profile_id TEXT NOT NULL,',
    '  recipe_id INTEGER NOT NULL,',
    '  ingredient_indices_json TEXT NOT NULL,',
    '  step_indices_json TEXT NOT NULL,',
    '  updated_at TEXT NOT NULL,',
    '  PRIMARY KEY (profile_id, recipe_id),',
    '  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,',
    '  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE',
    ');',
  ].join('\n'));

  const count = database.prepare('SELECT COUNT(*) AS count FROM recipes').get().count;
  if (count > 0) return;

  const insert = database.prepare([
    'INSERT INTO recipes (',
    'id, name, category, cuisine, difficulty, prep_time, cook_time, total_time, servings, rating, popularity,',
    'description, image, ingredients_json, steps_json, nutrition_json, nutrition_note',
    ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ].join(' '));
  for (const recipe of loadSeedRecipes()) {
    insert.run(
      recipe.id,
      recipe.name,
      recipe.category,
      recipe.cuisine,
      recipe.difficulty,
      recipe.prepTime,
      recipe.cookTime,
      recipe.totalTime,
      recipe.servings,
      recipe.rating,
      recipe.popularity,
      recipe.description,
      recipe.image,
      JSON.stringify(recipe.ingredients),
      JSON.stringify(recipe.steps),
      JSON.stringify(recipe.nutrition),
      recipe.nutritionNote,
    );
  }
}

function openDatabase(databasePath) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const database = new DatabaseSync(databasePath);
  initialiseDatabase(database);
  return database;
}

function toRecipe(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    cuisine: row.cuisine,
    difficulty: row.difficulty,
    prepTime: row.prep_time,
    cookTime: row.cook_time,
    totalTime: row.total_time,
    servings: row.servings,
    rating: row.rating,
    popularity: row.popularity,
    description: row.description,
    image: row.image,
    ingredients: JSON.parse(row.ingredients_json),
    steps: JSON.parse(row.steps_json),
    nutrition: JSON.parse(row.nutrition_json),
    nutritionNote: row.nutrition_note,
  };
}

function getRecipe(database, recipeId) {
  return toRecipe(database.prepare('SELECT * FROM recipes WHERE id = ?').get(recipeId));
}

function respondJson(response, status, body) {
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(body));
}

function respondError(response, status, message) {
  respondJson(response, status, { error: { message } });
}

function assertProfile(request, database) {
  const profileId = request.headers['x-client-id'];
  if (typeof profileId !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(profileId)) {
    throw new HttpError(400, 'A valid X-Client-Id header is required.');
  }
  database.prepare('INSERT OR IGNORE INTO profiles (id, created_at) VALUES (?, ?)').run(profileId, now());
  return profileId;
}

function parseRecipeId(value) {
  const recipeId = Number(value);
  if (!Number.isSafeInteger(recipeId) || recipeId < 1) {
    throw new HttpError(400, 'Recipe id must be a positive integer.');
  }
  return recipeId;
}

function validateDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, 'Date must use YYYY-MM-DD.');
  }
  const parsed = new Date(value + 'T00:00:00.000Z');
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new HttpError(400, 'Date must be valid.');
  }
  return value;
}

function validateMeal(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Meal data must be a JSON object.');
  }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const time = Number(body.time);
  const servings = Number(body.servings);
  const status = body.status === 'Completed' ? 'Completed' : 'Planned';
  if (!name || name.length > 120) throw new HttpError(400, 'Meal name must be between 1 and 120 characters.');
  if (!Number.isInteger(time) || time < 1 || time > 1440) throw new HttpError(400, 'Meal time must be between 1 and 1440 minutes.');
  if (!Number.isInteger(servings) || servings < 1 || servings > 100) throw new HttpError(400, 'Servings must be between 1 and 100.');
  if (description.length > 1000) throw new HttpError(400, 'Meal description must be 1000 characters or fewer.');
  return { name, time, servings, description, status };
}

function validateIndices(value, name, upperBound) {
  if (!Array.isArray(value)) throw new HttpError(400, name + ' must be an array.');
  const indexes = [...new Set(value)];
  if (!indexes.every(index => Number.isInteger(index) && index >= 0 && index < upperBound)) {
    throw new HttpError(400, name + ' contains an invalid index.');
  }
  return indexes.sort((first, second) => first - second);
}

async function readJsonBody(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'Request body is too large.');
    chunks.push(chunk);
  }
  if (size === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Request body must contain valid JSON.');
  }
}

function listFavorites(database, profileId) {
  return database
    .prepare('SELECT recipe_id FROM favorites WHERE profile_id = ? ORDER BY created_at DESC')
    .all(profileId)
    .map(row => row.recipe_id);
}

function listRecipes(database, searchParams) {
  const query = (searchParams.get('q') || '').trim().toLocaleLowerCase();
  const category = (searchParams.get('category') || '').trim().toLocaleLowerCase();
  const cuisine = (searchParams.get('cuisine') || '').trim().toLocaleLowerCase();
  const difficulty = (searchParams.get('difficulty') || '').trim().toLocaleLowerCase();
  const time = searchParams.get('time') || '';
  const sort = searchParams.get('sort') || 'rating';
  const validSorts = new Set(['rating', 'popular', 'fast', 'alpha', 'new']);
  const validTimes = new Set(['', 'under30', '30to60', 'over60']);
  if (!validSorts.has(sort)) throw new HttpError(400, 'Unsupported sort value.');
  if (!validTimes.has(time)) throw new HttpError(400, 'Unsupported time filter.');

  const recipes = database.prepare('SELECT * FROM recipes').all().map(toRecipe).filter(recipe => {
    const searchText = [
      recipe.name,
      recipe.description,
      recipe.category,
      recipe.cuisine,
      ...recipe.ingredients.map(ingredient => ingredient.name),
    ].join(' ').toLocaleLowerCase();
    const matchesTime = !time
      || (time === 'under30' && recipe.totalTime < 30)
      || (time === '30to60' && recipe.totalTime >= 30 && recipe.totalTime <= 60)
      || (time === 'over60' && recipe.totalTime > 60);
    return (!query || searchText.includes(query))
      && (!category || recipe.category.toLocaleLowerCase() === category)
      && (!cuisine || recipe.cuisine.toLocaleLowerCase() === cuisine)
      && (!difficulty || recipe.difficulty.toLocaleLowerCase() === difficulty)
      && matchesTime;
  });

  recipes.sort((first, second) => {
    if (sort === 'fast') return first.totalTime - second.totalTime;
    if (sort === 'alpha') return first.name.localeCompare(second.name);
    if (sort === 'new') return second.id - first.id;
    if (sort === 'popular') return second.popularity - first.popularity;
    return second.rating - first.rating;
  });
  return recipes;
}

function getPlan(database, profileId, date) {
  const rows = database.prepare([
    'SELECT meal_type, name, time_minutes, servings, description, status',
    'FROM meal_plans WHERE profile_id = ? AND plan_date = ?',
  ].join(' ')).all(profileId, date);
  return Object.fromEntries(rows.map(row => [row.meal_type, {
    name: row.name,
    time: row.time_minutes,
    servings: row.servings,
    description: row.description,
    status: row.status,
  }]));
}

function getProgress(database, profileId, recipeId) {
  const row = database.prepare([
    'SELECT ingredient_indices_json, step_indices_json',
    'FROM recipe_progress WHERE profile_id = ? AND recipe_id = ?',
  ].join(' ')).get(profileId, recipeId);
  if (!row) return { ingredients: [], steps: [] };
  return {
    ingredients: JSON.parse(row.ingredient_indices_json),
    steps: JSON.parse(row.step_indices_json),
  };
}

async function handleApi(request, response, url, database) {
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  const parts = pathname.split('/').filter(Boolean);

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Headers': 'Content-Type, X-Client-Id',
      'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Origin': '*',
    });
    response.end();
    return;
  }

  if (request.method === 'GET' && pathname === '/api/health') {
    respondJson(response, 200, { data: { status: 'ok', service: 'my-kitchen-api' } });
    return;
  }

  if (request.method === 'GET' && pathname === '/api/recipes') {
    const recipes = listRecipes(database, url.searchParams);
    respondJson(response, 200, { data: recipes, meta: { total: recipes.length } });
    return;
  }

  if (request.method === 'GET' && parts.length === 3 && parts[0] === 'api' && parts[1] === 'recipes') {
    const recipe = getRecipe(database, parseRecipeId(parts[2]));
    if (!recipe) throw new HttpError(404, 'Recipe not found.');
    respondJson(response, 200, { data: recipe });
    return;
  }

  if (parts[0] === 'api' && parts[1] === 'me') {
    const profileId = assertProfile(request, database);

    if (request.method === 'GET' && pathname === '/api/me/favorites') {
      respondJson(response, 200, { data: listFavorites(database, profileId) });
      return;
    }

    if (parts[2] === 'favorites' && parts.length === 4 && ['PUT', 'DELETE'].includes(request.method)) {
      const recipeId = parseRecipeId(parts[3]);
      if (!getRecipe(database, recipeId)) throw new HttpError(404, 'Recipe not found.');
      if (request.method === 'PUT') {
        database.prepare('INSERT OR IGNORE INTO favorites (profile_id, recipe_id, created_at) VALUES (?, ?, ?)').run(profileId, recipeId, now());
      } else {
        database.prepare('DELETE FROM favorites WHERE profile_id = ? AND recipe_id = ?').run(profileId, recipeId);
      }
      respondJson(response, 200, { data: listFavorites(database, profileId) });
      return;
    }

    if (parts[2] === 'meal-plans' && parts.length === 4 && request.method === 'GET') {
      const date = validateDate(parts[3]);
      respondJson(response, 200, { data: getPlan(database, profileId, date) });
      return;
    }

    if (parts[2] === 'meal-plans' && parts.length === 5 && request.method === 'PUT') {
      const date = validateDate(parts[3]);
      const mealType = decodeURIComponent(parts[4]);
      if (!MEAL_TYPES.has(mealType)) throw new HttpError(400, 'Unsupported meal type.');
      const meal = validateMeal(await readJsonBody(request));
      database.prepare([
        'INSERT INTO meal_plans (profile_id, plan_date, meal_type, name, time_minutes, servings, description, status, updated_at)',
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        'ON CONFLICT(profile_id, plan_date, meal_type) DO UPDATE SET',
        'name = excluded.name, time_minutes = excluded.time_minutes, servings = excluded.servings,',
        'description = excluded.description, status = excluded.status, updated_at = excluded.updated_at',
      ].join(' ')).run(profileId, date, mealType, meal.name, meal.time, meal.servings, meal.description, meal.status, now());
      respondJson(response, 200, { data: meal });
      return;
    }

    if (parts[2] === 'recipe-progress' && parts.length === 4) {
      const recipeId = parseRecipeId(parts[3]);
      const recipe = getRecipe(database, recipeId);
      if (!recipe) throw new HttpError(404, 'Recipe not found.');

      if (request.method === 'GET') {
        respondJson(response, 200, { data: getProgress(database, profileId, recipeId) });
        return;
      }

      if (request.method === 'PUT') {
        const body = await readJsonBody(request);
        const progress = {
          ingredients: validateIndices(body.ingredients, 'ingredients', recipe.ingredients.length),
          steps: validateIndices(body.steps, 'steps', recipe.steps.length),
        };
        database.prepare([
          'INSERT INTO recipe_progress (profile_id, recipe_id, ingredient_indices_json, step_indices_json, updated_at)',
          'VALUES (?, ?, ?, ?, ?)',
          'ON CONFLICT(profile_id, recipe_id) DO UPDATE SET',
          'ingredient_indices_json = excluded.ingredient_indices_json,',
          'step_indices_json = excluded.step_indices_json, updated_at = excluded.updated_at',
        ].join(' ')).run(profileId, recipeId, JSON.stringify(progress.ingredients), JSON.stringify(progress.steps), now());
        respondJson(response, 200, { data: progress });
        return;
      }
    }
  }

  throw new HttpError(404, 'API route not found.');
}

async function serveStatic(request, response, url) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    respondError(response, 405, 'Method not allowed.');
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    respondError(response, 400, 'Invalid path.');
    return;
  }
  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.resolve(ROOT_DIRECTORY, '.' + requestedPath);
  const safeRoot = ROOT_DIRECTORY.endsWith(path.sep) ? ROOT_DIRECTORY : ROOT_DIRECTORY + path.sep;
  if (filePath !== ROOT_DIRECTORY && !filePath.startsWith(safeRoot)) {
    respondError(response, 403, 'Forbidden.');
    return;
  }

  let stats;
  try {
    stats = await fsp.stat(filePath);
  } catch {
    respondError(response, 404, 'Not found.');
    return;
  }
  if (!stats.isFile()) {
    respondError(response, 404, 'Not found.');
    return;
  }

  response.writeHead(200, {
    'Content-Length': stats.size,
    'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
  });
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  fs.createReadStream(filePath).pipe(response);
}

function createApp(options = {}) {
  const databasePath = options.databasePath || DEFAULT_DATABASE_PATH;
  const database = openDatabase(databasePath);
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://' + (request.headers.host || 'localhost'));
      if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
        await handleApi(request, response, url, database);
      } else {
        await serveStatic(request, response, url);
      }
    } catch (error) {
      if (error instanceof HttpError) {
        respondError(response, error.status, error.message);
        return;
      }
      console.error(error);
      if (!response.headersSent) respondError(response, 500, 'Unexpected server error.');
      else response.end();
    }
  });

  return {
    database,
    server,
    close() {
      database.close();
    },
  };
}

if (require.main === module) {
  const app = createApp();
  app.server.listen(DEFAULT_PORT, () => {
    console.log('My Kitchen is running at http://localhost:' + DEFAULT_PORT);
  });
}

module.exports = { createApp, createRecipeDetails, loadSeedRecipes };
