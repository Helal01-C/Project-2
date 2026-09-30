let recipes = [];
const categories = ['Chicken', 'Beef', 'Fish', 'Seafood', 'Pasta', 'Rice', 'Curry', 'Vegetarian', 'Soup', 'Grilled', 'Fast Dinner', 'Bangladeshi'];
const categoryImages = ['photo-1603133872878-684f208fb84b', 'photo-1544025162-d76694265947', 'photo-1544943910-4c1dc44aab44', 'photo-1565680018434-b513d5e5fd47'];
function hydrate(recipe) {
   const protein = recipe.category === 'Vegetarian' ? 'mixed vegetables and chickpeas' : recipe.category.toLowerCase();
   const ingredients = [{
     name: recipe.category === 'Vegetarian' ? 'Mixed vegetables' : recipe.category === 'Fish' ? 'White fish' : 'Chicken', quantity: '500', unit: 'g', group: 'Main ingredients'
  }, {
     name: 'Onion', quantity: '2', unit: 'large', group: 'Aromatics'
  }, {
     name: 'Garlic', quantity: '3', unit: 'cloves', group: 'Aromatics'
  }, {
     name: 'Cooking oil', quantity: '2', unit: 'tbsp', group: 'Cooking essentials'
  }, {
     name: 'Seasoning', quantity: 'To taste', unit: '', group: 'Cooking essentials'
  }];
   return {
     ...recipe, image: recipe.image || `https://images.unsplash.com/photo-${recipe.id % 3 ? '1547592180-85f173990554' : '1603133872878-684f208fb84b'}?auto=format&fit=crop&w=1200&q=80`, description: recipe.description || `A satisfying ${recipe.cuisine} ${recipe.name.toLowerCase()} made for a relaxed dinner.`, ingredients: (recipe.ingredients || ingredients).map(item => typeof item === 'string' ? {
       name: item, quantity: '', unit: '', group: 'Ingredients'
    }
     : {
       ...item, unit: item.unit || '', group: item.group || 'Ingredients'
    }), steps: recipe.steps || [{
       title: 'Prepare the ingredients', time: '10 min', description: 'Measure and prepare all ingredients before heating the pan.'
    }, {
       title: 'Build the flavour base', time: '8 min', description: 'Cook the onion, garlic, and seasoning until fragrant.'
    }, {
       title: 'Cook the main ingredients', time: '15 min', description: `Cook the ${protein} over medium heat until evenly done.`
    }, {
       title: 'Finish and serve', time: '10 min', description: 'Simmer gently, taste, adjust seasoning, and serve hot.'
    }], nutrition: recipe.nutrition || {
       calories: '520 kcal', protein: '28 g', carbs: '54 g', fat: '20 g'
    }
  };
}
async function loadRecipes() {
   try {
     const response = await fetch('data/recipes.json');
     if (!response.ok) throw new Error();
     recipes = [...(await response.json()), ...additionalRecipes].map(hydrate).map(enhanceRecipe);
  }
   catch {
     recipes = [];
  }
   return recipes;
}
function card(recipe) {
   return `<article class="recipe-card"><div class="card-image"><img src="${recipe.image}" alt="${recipe.name}" onerror="imageFallback(this)"><button class="favorite ${isFavorite(recipe.id) ? 'saved' : ''}" aria-label="Save ${recipe.name}" data-fav="${recipe.id}">♥</button></div><div class="card-body"><h3>${recipe.name}</h3><p>${recipe.description}</p><div class="meta"><span><b>★ ${recipe.rating}</b></span><span>◷ ${recipe.totalTime} min</span><span>${recipe.difficulty}</span></div><div class="card-footer"><small>${recipe.category} · ${recipe.cuisine}</small><a href="recipe.html?id=${recipe.id}">View recipe →</a></div></div></article>`;
}
function bindFavorites(root = document) {
   root.querySelectorAll('[data-fav]').forEach(button => button.onclick = () => button.classList.toggle('saved', toggleFavorite(Number(button.dataset.fav))));
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
   const query = new URLSearchParams(location.search).get('q') || '', input = document.querySelector('#recipe-search'), cuisine = document.querySelector('#cuisine-filter');
   input.value = query;
  [...new Set(recipes.map(recipe => recipe.cuisine))].sort().forEach(value => cuisine.add(new Option(value, value)));
   const controls = ['protein-filter', 'cuisine-filter', 'difficulty-filter', 'time-filter', 'sort-filter'].map(id => document.querySelector(`#${id}`));
   const render = () => {
     let list = filterRecipes(recipes, {
       protein: controls[0].value, cuisine: controls[1].value, difficulty: controls[2].value, time: controls[3].value
    });
     list = list.filter(recipe => matchesSearch(recipe, input.value));
     list = sortRecipes(list, controls[4].value);
     document.querySelector('#result-count').textContent = `${list.length} recipe${list.length === 1 ? '' : 's'} found`;
     showCards(document.querySelector('#recipe-list'), list);
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
   await loadRecipes();
   const page = document.body.dataset.page;
   if (page === 'favorites') showCards(document.querySelector('#favorites-list'), recipes.filter(recipe => isFavorite(recipe.id)));
   if (page === 'categories') document.querySelector('#category-list').innerHTML = categories.map(categoryCard).join('');
   if (page === 'recipes') setupRecipes();
});
