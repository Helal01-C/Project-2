const defaults = {
  Breakfast: {
    name: 'Vegetable Omelette', time: 20, servings: 2, description: 'A bright, protein-rich start to your day.', image: 'https://images.unsplash.com/photo-1510693206972-df098062cb79?auto=format&fit=crop&w=900&q=80'
  }, Lunch: {
    name: 'Chicken Biryani', time: 75, servings: 4, description: 'A fragrant rice dish with tender chicken and spices.', image: 'https://images.unsplash.com/photo-1563379926898-05f4575a45d8?auto=format&fit=crop&w=900&q=80'
  }, Dinner: {
    name: 'Chicken Curry', time: 45, servings: 4, description: 'A comforting homemade curry for a relaxed evening.', image: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=900&q=80'
  }
};

const mealTypes = ['Breakfast', 'Lunch', 'Dinner'];
let selected = new Date();
let latestPlanRequest = 0;
let saveQueue = Promise.resolve();
const slotVersions = {};

function dateKey(date = selected) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const key = () => `myKitchen-plan-${dateKey()}`;

function read() {
  try {
    const plan = JSON.parse(localStorage.getItem(key()));
    return plan && typeof plan === 'object' ? plan : {};
  } catch {
    return {};
  }
}

function save(plan) {
  try {
    localStorage.setItem(key(), JSON.stringify(plan));
  } catch {
    // Local storage remains an offline cache only.
  }
}

const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);

function mealNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function normalizeMeal(type, meal = {}) {
  const fallback = defaults[type];
  return {
    ...fallback,
    ...meal,
    name: meal.name || meal.title || fallback.name,
    time: mealNumber(meal.time ?? meal.totalTime ?? meal.totalTimeMinutes, fallback.time),
    servings: mealNumber(meal.servings, fallback.servings),
    description: meal.description || fallback.description,
    image: meal.image || meal.imageUrl || fallback.image,
    status: meal.status === 'Completed' || meal.status === 'COMPLETED' ? 'Completed' : 'Planned',
  };
}

function normalizePlan(plan) {
  return mealTypes.reduce((normalized, type) => {
    if (plan?.[type]) normalized[type] = normalizeMeal(type, plan[type]);
    return normalized;
  }, {});
}

function renderPlan(plan) {
  const normalized = normalizePlan(plan);
  const completed = mealTypes.filter(type => normalized[type]?.status === 'Completed').length;
  document.querySelector('#meal-progress').textContent = `${completed} / 3 meals completed`;
  document.querySelector('#progress-percent').textContent = `${Math.round(completed / 3 * 100)}%`;
  document.querySelector('#meal-progress-bar').style.width = `${completed / 3 * 100}%`;
  document.querySelector('#daily-meals').innerHTML = mealTypes.map(type => {
    const meal = normalizeMeal(type, normalized[type]);
    const done = meal.status === 'Completed';
    return `<article class="daily-meal ${done ? 'cooked' : ''}"><img src="${escapeHtml(meal.image)}" alt="${escapeHtml(meal.name)}" onerror="imageFallback(this)"><div class="meal-copy"><p class="eyebrow">${type.toUpperCase()} · ${done ? '✓ COOKED' : '○ PLANNED'}</p><h3>${escapeHtml(meal.name)}</h3><p>${escapeHtml(meal.description)}</p><div class="meal-meta"><span>◷ ${escapeHtml(meal.time)} min</span><span>🍽 ${escapeHtml(meal.servings)} servings</span></div><div class="meal-actions"><a href="recipes.html?q=${encodeURIComponent(meal.name)}">Find recipe</a><button data-status="${type}">${done ? 'Mark planned' : 'Mark as cooked'}</button></div></div></article>`;
  }).join('');
  document.querySelectorAll('[data-status]').forEach(button => button.onclick = () => {
    const type = button.dataset.status;
    const plan = normalizePlan(read());
    const meal = normalizeMeal(type, plan[type]);
    saveMeal(type, { ...meal, status: meal.status === 'Completed' ? 'Planned' : 'Completed' });
  });
}

function renderDates() {
  document.querySelector('#day-name').textContent = selected.toLocaleDateString(undefined, { weekday: 'long' });
  document.querySelector('#date-label').textContent = selected.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  document.querySelector('#display-date').textContent = `Here is your meal plan for ${selected.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}.`;
}

function apiMeal(meal) {
  return {
    name: meal.name,
    time: Number(meal.time),
    servings: Number(meal.servings),
    description: meal.description || '',
    image: meal.image || '',
    status: meal.status,
  };
}

function saveMeal(type, meal) {
  const plan = normalizePlan(read());
  const savedMeal = normalizeMeal(type, meal);
  plan[type] = savedMeal;
  save(plan);
  renderPlan(plan);

  const planDate = dateKey();
  const versionKey = `${planDate}:${type}`;
  const version = (slotVersions[versionKey] || 0) + 1;
  slotVersions[versionKey] = version;
  saveQueue = saveQueue.catch(() => undefined).then(async () => {
    if (!window.MyKitchenApi) return;
    try {
      const remoteMeal = await window.MyKitchenApi.saveMealPlanSlot(planDate, type, apiMeal(savedMeal));
      if (slotVersions[versionKey] !== version || dateKey() !== planDate) return;
      const currentPlan = normalizePlan(read());
      currentPlan[type] = normalizeMeal(type, remoteMeal || savedMeal);
      save(currentPlan);
      renderPlan(currentPlan);
    } catch {
      // The cached plan above is the graceful offline fallback.
    }
  });
}

async function refreshPlan() {
  const requestId = ++latestPlanRequest;
  const requestedDate = dateKey();
  renderDates();
  renderPlan(read());
  if (!window.MyKitchenApi) return;
  try {
    const plan = normalizePlan(await window.MyKitchenApi.getMealPlan(requestedDate));
    if (requestId !== latestPlanRequest || dateKey() !== requestedDate) return;
    save(plan);
    renderPlan(plan);
  } catch {
    // The immediate local render remains visible when the API is unavailable.
  }
}

document.addEventListener('DOMContentLoaded', () => {
  refreshPlan();
  document.querySelector('#previous-day').onclick = () => {
    selected.setDate(selected.getDate() - 1);
    refreshPlan();
  };
  document.querySelector('#next-day').onclick = () => {
    selected.setDate(selected.getDate() + 1);
    refreshPlan();
  };
  const dialog = document.querySelector('#meal-dialog');
  document.querySelector('#add-meal').onclick = () => dialog.showModal();
  dialog.querySelector('.close').onclick = () => dialog.close();
  document.querySelector('#meal-form').onsubmit = event => {
    event.preventDefault();
    const value = Object.fromEntries(new FormData(event.target));
    saveMeal(value.type, {
      name: value.name,
      time: Number(value.time),
      servings: Number(value.servings),
      description: value.description,
      status: 'Planned',
    });
    dialog.close();
    event.target.reset();
  };
  const dark = localStorage.getItem('myKitchen-theme') === 'dark';
  const themeButton = document.querySelector('#theme-toggle');
  document.body.classList.toggle('dark', dark);
  themeButton.textContent = dark ? '☀️ Light mode' : '🌙 Dark mode';
  themeButton.onclick = () => {
    const isDark = document.body.classList.toggle('dark');
    localStorage.setItem('myKitchen-theme', isDark ? 'dark' : 'light');
    themeButton.textContent = isDark ? '☀️ Light mode' : '🌙 Dark mode';
  };
});
