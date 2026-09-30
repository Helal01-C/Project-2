document.addEventListener('DOMContentLoaded', async () => {
    const root = document.querySelector('#recipe-detail');
    try {
        const response = await fetch('data/recipes.json');
        if (!response.ok) throw new Error('Could not load recipes');
        const list = [...(await response.json()), ...additionalRecipes].map(hydrate).map(enhanceRecipe);
        const id = Number(new URLSearchParams(location.search).get('id'));
        const recipe = list.find(item => item.id === id);
        if (!recipe) throw new Error('Recipe not found');
        const storageKey = `myKitchen-progress-${id}`;
        let state;
        try {
       state = JSON.parse(localStorage.getItem(storageKey)) || {
         ingredients: [], steps: []
      };
    }
     catch {
       state = {
         ingredients: [], steps: []
      };
    }
        const save = () => localStorage.setItem(storageKey, JSON.stringify(state));
        root.innerHTML = `<div class="recipe-layout"><div class="recipe-hero-image"><img src="${recipe.image}" alt="${recipe.name}" onerror="imageFallback(this)"></div><div class="recipe-summary"><p class="eyebrow">${recipe.category.toUpperCase()} DINNER</p><h1>${recipe.name}</h1><p>${recipe.description}</p><p class="rating">★ ${recipe.rating} rating</p><button class="favorite ${isFavorite(id) ? 'saved' : ''}" id="detail-fav">♥ Save favorite</button><div class="detail-meta"><div class="info-card"><b>${recipe.prepTime} min</b>Prep</div><div class="info-card"><b>${recipe.cookTime} min</b>Cook</div><div class="info-card"><b>${recipe.totalTime} min</b>Total</div><div class="info-card"><b>${recipe.servings}</b>Serves</div></div></div></div><section class="detail-section"><p class="eyebrow">SHOPPING LIST</p><h2>Ingredients</h2><div class="ingredients">${recipe.ingredients.map((item, index) => `<button class="ingredient ${state.ingredients.includes(index) ? 'done' : ''}" data-ingredient="${index}">☐ ${
      item.quantity
    }
     ${
      item.unit || ''
    }
     ${
      item.name
    }
    </button>`).join('')}</div></section><section class="detail-section"><p class="eyebrow">COOK WITH CONFIDENCE</p><h2>Step-by-step instructions</h2><div class="progress-line"><span id="progress-text"></span><span>Keep going!</span></div><div class="progress"><i id="progress-bar"></i></div><div id="steps">${recipe.steps.map((step, index) => `<article class="step ${state.steps.includes(index) ? 'complete' : ''}"><div class="step-top"><div><span class="step-num">STEP ${
      String(index + 1).padStart(2, '0')
    }
    </span><h3>${
      step.title
    }
    </h3></div><span>◷ ${
      step.time || '5 min'
    }
    </span></div><p>${
      step.description
    }
    </p><button data-step="${index}">${
      state.steps.includes(index) ? '✓ Completed' : '✓ Mark complete'
    }
    </button></article>`).join('')}</div></section><section class="detail-section"><p class="eyebrow">PER SERVING</p><h2>Nutrition</h2><div class="nutrition">${Object.entries(recipe.nutrition).map(([name, value]) => `<div><b>${
      value
    }
    </b>${
      name
    }
    </div>`).join('')}</div></section><section class="detail-section"><h2>Related dinners</h2><div id="related" class="recipe-grid"></div></section>`;
        const updateProgress = () => {
       const count = state.steps.length;
       root.querySelector('#progress-text').textContent = `${count} of ${recipe.steps.length} steps completed`;
       root.querySelector('#progress-bar').style.width = `${count / recipe.steps.length * 100}%`;
    };
        root.querySelector('#detail-fav').onclick = event => event.currentTarget.classList.toggle('saved', toggleFavorite(id));
        root.querySelectorAll('[data-ingredient]').forEach(button => button.onclick = () => {
       const index = Number(button.dataset.ingredient);
       state.ingredients = state.ingredients.includes(index) ? state.ingredients.filter(item => item !== index) : [...state.ingredients, index];
       button.classList.toggle('done');
       save();
    });
        root.querySelectorAll('[data-step]').forEach(button => button.onclick = () => {
       const index = Number(button.dataset.step);
       state.steps = state.steps.includes(index) ? state.steps.filter(item => item !== index) : [...state.steps, index];
       const complete = state.steps.includes(index);
       button.textContent = complete ? '✓ Completed' : '✓ Mark complete';
       button.closest('.step').classList.toggle('complete', complete);
       save();
       updateProgress();
    });
        updateProgress();
        root.querySelector('#related').innerHTML = list.filter(item => item.id !== id && (item.category === recipe.category || item.cuisine === recipe.cuisine)).slice(0, 3).map(card).join('');
        bindFavorites(root.querySelector('#related'));
  }
   catch {
        root.innerHTML = '<section class="not-found"><h1>Recipe not found</h1><p>Please choose a recipe from the dinner list.</p><a class="button" href="recipes.html">Browse recipes</a></section>';
  }
});
