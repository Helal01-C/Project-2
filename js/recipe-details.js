function progressKey(item, index) {
  const candidate = Number(item?.id ?? item?.position ?? index);
  return Number.isFinite(candidate) ? candidate : index;
}

function normalizeProgress(value) {
  return {
    ingredients: Array.isArray(value?.ingredients) ? value.ingredients.map(Number).filter(Number.isFinite) : [],
    steps: Array.isArray(value?.steps) ? value.steps.map(Number).filter(Number.isFinite) : [],
  };
}

function readLocalProgress(storageKey) {
  try {
    return normalizeProgress(JSON.parse(localStorage.getItem(storageKey)));
  } catch {
    return { ingredients: [], steps: [] };
  }
}

function writeLocalProgress(storageKey, state) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // Browser storage is retained as an offline fallback.
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const root = document.querySelector('#recipe-detail');
  try {
    const id = Number(new URLSearchParams(location.search).get('id'));
    if (!Number.isFinite(id)) throw new Error('Recipe not found');

    const [favoriteLoad, recipeLoad] = [
      typeof loadFavorites === 'function' ? loadFavorites() : Promise.resolve(),
      window.MyKitchenApi.getRecipe(id),
    ];
    let recipe;
    try {
      const [, data] = await Promise.all([favoriteLoad, recipeLoad]);
      recipe = hydrate(data);
    } catch {
      if (typeof loadFavorites === 'function') await loadFavorites();
      const list = await loadRecipes();
      recipe = list.find(item => Number(item.id) === id);
    }
    if (!recipe) throw new Error('Recipe not found');

    const storageKey = `myKitchen-progress-${id}`;
    let state = readLocalProgress(storageKey);
    try {
      state = normalizeProgress(await window.MyKitchenApi.getRecipeProgress(id));
      writeLocalProgress(storageKey, state);
    } catch {
      // Keep the previously saved local state while the API is unavailable.
    }

    root.innerHTML = `<div class="recipe-layout"><div class="recipe-hero-image"><img src="${recipe.image}" alt="${recipe.name}" onerror="imageFallback(this)"></div><div class="recipe-summary"><p class="eyebrow">${recipe.category.toUpperCase()} DINNER</p><h1>${recipe.name}</h1><p>${recipe.description}</p><p class="rating">★ ${recipe.rating} rating</p><button class="favorite ${isFavorite(id) ? 'saved' : ''}" id="detail-fav">♥ Save favorite</button><div class="detail-meta"><div class="info-card"><b>${recipe.prepTime} min</b>Prep</div><div class="info-card"><b>${recipe.cookTime} min</b>Cook</div><div class="info-card"><b>${recipe.totalTime} min</b>Total</div><div class="info-card"><b>${recipe.servings}</b>Serves</div></div></div></div><section class="detail-section"><p class="eyebrow">SHOPPING LIST</p><h2>Ingredients</h2><div class="ingredients">${recipe.ingredients.map((item, index) => {
      const itemKey = progressKey(item, index);
      return `<button class="ingredient ${state.ingredients.includes(itemKey) ? 'done' : ''}" data-ingredient="${itemKey}">☐ ${item.quantity} ${item.unit || ''} ${item.name}</button>`;
    }).join('')}</div></section><section class="detail-section"><p class="eyebrow">COOK WITH CONFIDENCE</p><h2>Step-by-step instructions</h2><div class="progress-line"><span id="progress-text"></span><span>Keep going!</span></div><div class="progress"><i id="progress-bar"></i></div><div id="steps">${recipe.steps.map((step, index) => {
      const stepKey = progressKey(step, index);
      return `<article class="step ${state.steps.includes(stepKey) ? 'complete' : ''}"><div class="step-top"><div><span class="step-num">STEP ${String(index + 1).padStart(2, '0')}</span><h3>${step.title}</h3></div><span>◷ ${step.time || '5 min'}</span></div><p>${step.description}</p><button data-step="${stepKey}">${state.steps.includes(stepKey) ? '✓ Completed' : '✓ Mark complete'}</button></article>`;
    }).join('')}</div></section><section class="detail-section"><p class="eyebrow">PER SERVING</p><h2>Nutrition</h2><div class="nutrition">${Object.entries(recipe.nutrition).map(([name, value]) => `<div><b>${value}</b>${name}</div>`).join('')}</div></section><section class="detail-section"><h2>Related dinners</h2><div id="related" class="recipe-grid"></div></section>`;

    const updateProgress = () => {
      const count = state.steps.length;
      root.querySelector('#progress-text').textContent = `${count} of ${recipe.steps.length} steps completed`;
      root.querySelector('#progress-bar').style.width = `${count / recipe.steps.length * 100}%`;
    };
    let progressVersion = 0;
    let saveQueue = Promise.resolve();
    const save = () => {
      writeLocalProgress(storageKey, state);
      const snapshot = normalizeProgress(state);
      const version = ++progressVersion;
      saveQueue = saveQueue.catch(() => undefined).then(async () => {
        try {
          const saved = await window.MyKitchenApi.saveRecipeProgress(id, snapshot);
          if (version === progressVersion) writeLocalProgress(storageKey, normalizeProgress(saved));
        } catch {
          // The local cache above preserves progress until the service returns.
        }
      });
      return saveQueue;
    };

    root.querySelector('#detail-fav').onclick = async event => {
      const saved = await toggleFavorite(id);
      event.currentTarget.classList.toggle('saved', saved);
    };
    root.querySelectorAll('[data-ingredient]').forEach(button => button.onclick = () => {
      const itemKey = Number(button.dataset.ingredient);
      state.ingredients = state.ingredients.includes(itemKey)
        ? state.ingredients.filter(item => item !== itemKey)
        : [...state.ingredients, itemKey];
      button.classList.toggle('done', state.ingredients.includes(itemKey));
      save();
    });
    root.querySelectorAll('[data-step]').forEach(button => button.onclick = () => {
      const stepKey = Number(button.dataset.step);
      state.steps = state.steps.includes(stepKey)
        ? state.steps.filter(item => item !== stepKey)
        : [...state.steps, stepKey];
      const complete = state.steps.includes(stepKey);
      button.textContent = complete ? '✓ Completed' : '✓ Mark complete';
      button.closest('.step').classList.toggle('complete', complete);
      save();
      updateProgress();
    });
    updateProgress();

    const related = await loadRecipes();
    root.querySelector('#related').innerHTML = related.filter(item => item.id !== recipe.id && (item.category === recipe.category || item.cuisine === recipe.cuisine)).slice(0, 3).map(card).join('');
    bindFavorites(root.querySelector('#related'));
  } catch {
    root.innerHTML = '<section class="not-found"><h1>Recipe not found</h1><p>Please choose a recipe from the dinner list.</p><a class="button" href="recipes.html">Browse recipes</a></section>';
  }
});
