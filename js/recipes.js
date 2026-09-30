let recipes = [];
let recipeTotal = 0;
let fallbackRecipes;

const categories = ['Chicken', 'Beef', 'Fish', 'Seafood', 'Pasta', 'Rice', 'Curry', 'Vegetarian', 'Soup', 'Grilled', 'Fast Dinner', 'Bangladeshi'];
const categoryImages = ['photo-1603133872878-684f208fb84b', 'photo-1544025162-d76694265947', 'photo-1544943910-4c1dc44aab44', 'photo-1565680018434-b513d5e5fd47'];

function minutes(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function hydrate(recipe) {
  const category = recipe.category || 'Dinner';
  const protein = category === 'Vegetarian' ? 'mixed vegetables and chickpeas' : category.toLowerCase();
  const ingredients = [{
    name: category === 'Vegetarian' ? 'Mixed vegetables' : category === 'Fish' ? 'White fish' : 'Chicken', quantity: '500', unit: 'g', group: 'Main ingredients'
  }, {
    name: 'Onion', quantity: '2', unit: 'large', group: 'Aromatics'
  }, {
    name: 'Garlic', quantity: '3', unit: 'cloves', group: 'Aromatics'
  }, {
    name: 'Cooking oil', quantity: '2', unit: 'tbsp', group: 'Cooking essentials'
  }, {
    name: 'Seasoning', quantity: 'To taste', unit: '', group: 'Cooking essentials'
  }];
  const totalTime = minutes(recipe.totalTime ?? recipe.totalTimeMinutes, 45);
  return {
    ...recipe,
    category,
    cuisine: recipe.cuisine || 'International',
    prepTime: minutes(recipe.prepTime ?? recipe.prepTimeMinutes, 15),
    cookTime: minutes(recipe.cookTime ?? recipe.cookTimeMinutes, Math.max(0, totalTime - 15)),
    totalTime,
    servings: minutes(recipe.servings, 4),
    image: recipe.image || recipe.imageUrl || `https://images.unsplash.com/photo-${Number(recipe.id) % 3 ? '1547592180-85f173990554' : '1603133872878-684f208fb84b'}?auto=format&fit=crop&w=1200&q=80`,
    description: recipe.description || `A satisfying ${recipe.cuisine || 'home-style'} ${(recipe.name || 'dinner').toLowerCase()} made for a relaxed dinner.`,
    ingredients: (Array.isArray(recipe.ingredients) && recipe.ingredients.length ? recipe.ingredients : ingredients).map(item => typeof item === 'string' ? {
      name: item, quantity: '', unit: '', group: 'Ingredients'
    } : {
      ...item, unit: item.unit || '', group: item.group || 'Ingredients'
    }),
    steps: (Array.isArray(recipe.steps) && recipe.steps.length ? recipe.steps : [{
      title: 'Prepare the ingredients', time: '10 min', description: 'Measure and prepare all ingredients before heating the pan.'
    }, {
      title: 'Build the flavour base', time: '8 min', description: 'Cook the onion, garlic, and seasoning until fragrant.'
    }, {
      title: 'Cook the main ingredients', time: '15 min', description: `Cook the ${protein} over medium heat until evenly done.`
    }, {
      title: 'Finish and serve', time: '10 min', description: 'Simmer gently, taste, adjust seasoning, and serve hot.'
    }]).map(step => ({
      ...step,
      time: step.time || (Number.isFinite(Number(step.timeMinutes ?? step.durationMinutes)) ? `${Number(step.timeMinutes ?? step.durationMinutes)} min` : '5 min'),
    })),
    nutrition: recipe.nutrition || {
      calories: '520 kcal', protein: '28 g', carbs: '54 g', fat: '20 g'
    }
  };
}

async function loadFallbackRecipes() {
  if (fallbackRecipes) return fallbackRecipes;
  const response = await fetch('data/recipes.json');
  if (!response.ok) throw new Error('Could not load fallback recipes');
  const extra = typeof additionalRecipes === 'undefined' ? [] : additionalRecipes;
  fallbackRecipes = [...(await response.json()), ...extra].map(hydrate).map(enhanceRecipe);
  return fallbackRecipes;
}

function fallbackFilteredRecipes(list, filters) {
  if (typeof filterRecipes !== 'function' || typeof matchesSearch !== 'function' || typeof sortRecipes !== 'function') {
    return list;
  }
  let result = filterRecipes(list, {
    protein: filters.category || '',
    cuisine: filters.cuisine || '',
    difficulty: filters.difficulty || '',
    time: filters.time || '',
  });
  result = result.filter(recipe => matchesSearch(recipe, filters.q || ''));
  return sortRecipes(result, filters.sort || 'rating');
}

async function loadRecipes(filters = {}) {
  try {
    const response = await window.MyKitchenApi.getRecipes(filters);
    recipes = response.data.map(hydrate);
    recipeTotal = Number.isFinite(Number(response.meta.total)) ? Number(response.meta.total) : recipes.length;
  } catch {
    try {
      recipes = fallbackFilteredRecipes(await loadFallbackRecipes(), filters);
      recipeTotal = recipes.length;
    } catch {
      recipes = [];
      recipeTotal = 0;
    }
  }
  return recipes;
}

function card(recipe) {
  return `<article class="recipe-card"><div class="card-image"><img src="${recipe.image}" alt="${recipe.name}" onerror="imageFallback(this)"><button class="favorite ${isFavorite(recipe.id) ? 'saved' : ''}" aria-label="Save ${recipe.name}" data-fav="${recipe.id}">♥</button></div><div class="card-body"><h3>${recipe.name}</h3><p>${recipe.description}</p><div class="meta"><span><b>★ ${recipe.rating}</b></span><span>◷ ${recipe.totalTime} min</span><span>${recipe.difficulty}</span></div><div class="card-footer"><small>${recipe.category} · ${recipe.cuisine}</small><a href="recipe.html?id=${recipe.id}">View recipe →</a></div></div></article>`;
}

function bindFavorites(root = document) {
  root.querySelectorAll('[data-fav]').forEach(button => button.onclick = async () => {
    const saved = await toggleFavorite(Number(button.dataset.fav));
    button.classList.toggle('saved', saved);
  });
}

function showCards(element, list) {
  element.innerHTML = list.length ? list.map(card).join('') : '<div class="empty"><h2>No dinners found</h2><p>Try a different search or filter.</p></div>';
  bindFavorites(element);
}

function categoryCard(category) {
  const count = recipes.filter(recipe => recipe.category === category || recipe.cuisine === category).length;
  const image = categoryImages[categories.indexOf(category) % categoryImages.length];
  return `<a class="category" href="recipes.html?q=${encodeURIComponent(category)}" style="--bg:url('https://images.unsplash.com/${image}?auto=format&fit=crop&w=600&q=80')"><h3>${category}</h3><span>${count} recipes</span></a>`;
}

function setupRecipes() {
  const query = new URLSearchParams(location.search).get('q') || '';
  const input = document.querySelector('#recipe-search');
  const cuisine = document.querySelector('#cuisine-filter');
  input.value = query;
  [...new Set(recipes.map(recipe => recipe.cuisine))].sort().forEach(value => cuisine.add(new Option(value, value)));
  const controls = ['protein-filter', 'cuisine-filter', 'difficulty-filter', 'time-filter', 'sort-filter'].map(id => document.querySelector(`#${id}`));
  let latestRender = 0;
  const render = async () => {
    const renderId = ++latestRender;
    await loadRecipes({
      q: input.value,
      category: controls[0].value,
      cuisine: controls[1].value,
      difficulty: controls[2].value,
      time: controls[3].value,
      sort: controls[4].value,
    });
    if (renderId !== latestRender) return;
    document.querySelector('#result-count').textContent = `${recipeTotal} recipe${recipeTotal === 1 ? '' : 's'} found`;
    showCards(document.querySelector('#recipe-list'), recipes);
  };
  input.oninput = render;
  controls.forEach(control => control.onchange = render);
  document.querySelector('#clear-search').onclick = () => {
    input.value = '';
    controls.forEach(control => control.selectedIndex = 0);
    render();
  };
  render();
}

document.addEventListener('DOMContentLoaded', async () => {
  const page = document.body.dataset.page;
  if (!['favorites', 'categories', 'recipes'].includes(page)) return;
  await Promise.all([
    loadRecipes(),
    typeof loadFavorites === 'function' ? loadFavorites() : Promise.resolve(),
  ]);
  if (page === 'favorites') showCards(document.querySelector('#favorites-list'), recipes.filter(recipe => isFavorite(recipe.id)));
  if (page === 'categories') document.querySelector('#category-list').innerHTML = categories.map(categoryCard).join('');
  if (page === 'recipes') setupRecipes();
});
