const defaults = {
   Breakfast: {
     name: 'Vegetable Omelette', time: 20, servings: 2, description: 'A bright, protein-rich start to your day.', image: 'https://images.unsplash.com/photo-1510693206972-df098062cb79?auto=format&fit=crop&w=900&q=80'
  }, Lunch: {
     name: 'Chicken Biryani', time: 75, servings: 4, description: 'A fragrant rice dish with tender chicken and spices.', image: 'https://images.unsplash.com/photo-1563379926898-05f4575a45d8?auto=format&fit=crop&w=900&q=80'
  }, Dinner: {
     name: 'Chicken Curry', time: 45, servings: 4, description: 'A comforting homemade curry for a relaxed evening.', image: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=900&q=80'
  }
};
let selected = new Date();
const key = () => `myKitchen-plan-${selected.toISOString().slice(0, 10)}`;
const read = () => {
   try {
     return JSON.parse(localStorage.getItem(key())) || {
    };
  }
   catch {
     return {
    };
  }
};
const save = plan => localStorage.setItem(key(), JSON.stringify(plan));
const escapeHtml = value => String(value).replace(
  /[&<>"']/g,
  char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char],
);
function render() {
  document.querySelector('#day-name').textContent = selected.toLocaleDateString(undefined, { weekday: 'long' }); document.querySelector('#date-label').textContent = selected.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }); document.querySelector('#display-date').textContent = `Here is your meal plan for ${selected.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}.`;
  const plan = read(), meals = ['Breakfast', 'Lunch', 'Dinner'], completed = meals.filter(type => plan[type]?.status === 'Completed').length;
  document.querySelector('#meal-progress').textContent = `${completed} / 3 meals completed`; document.querySelector('#progress-percent').textContent = `${Math.round(completed / 3 * 100)}%`; document.querySelector('#meal-progress-bar').style.width = `${completed / 3 * 100}%`;
  document.querySelector('#daily-meals').innerHTML = meals.map(type => { const meal = { ...defaults[type], ...(plan[type] || {}) }; const done = meal.status === 'Completed'; return `<article class="daily-meal ${done ? 'cooked' : ''}"><img src="${escapeHtml(meal.image)}" alt="${escapeHtml(meal.name)}" onerror="imageFallback(this)"><div class="meal-copy"><p class="eyebrow">${type.toUpperCase()} · ${done ? '✓ COOKED' : '○ PLANNED'}</p><h3>${escapeHtml(meal.name)}</h3><p>${escapeHtml(meal.description)}</p><div class="meal-meta"><span>◷ ${escapeHtml(meal.time)} min</span><span>🍽 ${escapeHtml(meal.servings)} servings</span></div><div class="meal-actions"><a href="recipes.html?q=${encodeURIComponent(meal.name)}">Find recipe</a><button data-status="${type}">${done ? 'Mark planned' : 'Mark as cooked'}</button></div></div></article>`; }).join('');
  document.querySelectorAll('[data-status]').forEach(button => button.onclick = () => { const plan = read(), type = button.dataset.status; plan[type] = { ...(plan[type] || {}), status: plan[type]?.status === 'Completed' ? 'Planned' : 'Completed' }; save(plan); render(); });
}
document.addEventListener('DOMContentLoaded', () => { render(); document.querySelector('#previous-day').onclick = () => { selected.setDate(selected.getDate() - 1); render(); }; document.querySelector('#next-day').onclick = () => { selected.setDate(selected.getDate() + 1); render(); }; const dialog = document.querySelector('#meal-dialog'); document.querySelector('#add-meal').onclick = () => dialog.showModal(); dialog.querySelector('.close').onclick = () => dialog.close(); document.querySelector('#meal-form').onsubmit = event => { event.preventDefault(); const value = Object.fromEntries(new FormData(event.target)), plan = read(); plan[value.type] = { ...defaults[value.type], name: value.name, time: Number(value.time), servings: Number(value.servings), description: value.description, status: 'Planned' }; save(plan); dialog.close(); event.target.reset(); render(); }; const dark = localStorage.getItem('myKitchen-theme') === 'dark', themeButton = document.querySelector('#theme-toggle'); document.body.classList.toggle('dark', dark); themeButton.textContent = dark ? '☀️ Light mode' : '🌙 Dark mode'; themeButton.onclick = () => { const isDark = document.body.classList.toggle('dark'); localStorage.setItem('myKitchen-theme', isDark ? 'dark' : 'light'); themeButton.textContent = isDark ? '☀️ Light mode' : '🌙 Dark mode'; }; });
