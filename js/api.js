(() => {
  const CLIENT_ID_KEY = 'myKitchen-client-id';

  class ApiError extends Error {
    constructor(message, status = 0) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
    }
  }

  function clientId() {
    try {
      const existing = localStorage.getItem(CLIENT_ID_KEY);
      if (existing) return existing;
      const generated = globalThis.crypto?.randomUUID
        ? globalThis.crypto.randomUUID()
        : `mk-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      localStorage.setItem(CLIENT_ID_KEY, generated);
      return generated;
    } catch {
      return 'my-kitchen-browser';
    }
  }

  async function request(path, { method = 'GET', body } = {}) {
    let response;
    try {
      response = await fetch(path, {
        method,
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          'X-Client-Id': clientId(),
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new ApiError('The My Kitchen service is unavailable.');
    }

    let payload = {};
    try {
      payload = await response.json();
    } catch {
      // A non-JSON response still becomes a useful request error below.
    }

    if (!response.ok) {
      throw new ApiError(payload?.error?.message || 'The request could not be completed.', response.status);
    }
    return payload;
  }

  function recipeQuery(filters = {}) {
    const query = new URLSearchParams();
    ['q', 'category', 'cuisine', 'difficulty', 'time', 'sort'].forEach(key => {
      const value = filters[key];
      if (value) query.set(key, value);
    });
    const encoded = query.toString();
    return encoded ? `?${encoded}` : '';
  }

  window.MyKitchenApi = {
    ApiError,
    async getRecipes(filters) {
      const payload = await request(`/api/recipes${recipeQuery(filters)}`);
      return { data: Array.isArray(payload.data) ? payload.data : [], meta: payload.meta || {} };
    },
    async getRecipe(recipeId) {
      return (await request(`/api/recipes/${encodeURIComponent(recipeId)}`)).data;
    },
    async getFavorites() {
      const data = (await request('/api/me/favorites')).data;
      return Array.isArray(data) ? data : [];
    },
    async addFavorite(recipeId) {
      const data = (await request(`/api/me/favorites/${encodeURIComponent(recipeId)}`, { method: 'PUT' })).data;
      return Array.isArray(data) ? data : [];
    },
    async removeFavorite(recipeId) {
      const data = (await request(`/api/me/favorites/${encodeURIComponent(recipeId)}`, { method: 'DELETE' })).data;
      return Array.isArray(data) ? data : [];
    },
    async getMealPlan(date) {
      const data = (await request(`/api/me/meal-plans/${encodeURIComponent(date)}`)).data;
      return data && typeof data === 'object' ? data : {};
    },
    async saveMealPlanSlot(date, mealType, meal) {
      return (await request(`/api/me/meal-plans/${encodeURIComponent(date)}/${encodeURIComponent(mealType)}`, {
        method: 'PUT',
        body: meal,
      })).data;
    },
    async getRecipeProgress(recipeId) {
      const data = (await request(`/api/me/recipe-progress/${encodeURIComponent(recipeId)}`)).data;
      return {
        ingredients: Array.isArray(data?.ingredients) ? data.ingredients : [],
        steps: Array.isArray(data?.steps) ? data.steps : [],
      };
    },
    async saveRecipeProgress(recipeId, progress) {
      const data = (await request(`/api/me/recipe-progress/${encodeURIComponent(recipeId)}`, {
        method: 'PUT',
        body: {
          ingredients: Array.isArray(progress?.ingredients) ? progress.ingredients : [],
          steps: Array.isArray(progress?.steps) ? progress.steps : [],
        },
      })).data;
      return {
        ingredients: Array.isArray(data?.ingredients) ? data.ingredients : [],
        steps: Array.isArray(data?.steps) ? data.steps : [],
      };
    },
  };
})();
