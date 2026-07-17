/* Shared helpers used across all pages */

const api = {
  async getProducts(params = {}) {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`/api/products${qs ? '?' + qs : ''}`);
    return res.json();
  },
  async getProduct(id) {
    const res = await fetch(`/api/products/${id}`);
    if (!res.ok) throw new Error('Product not found');
    return res.json();
  },
  async getCategories() {
    const res = await fetch('/api/categories');
    return res.json();
  },
  async getCart() {
    const res = await fetch('/api/cart');
    return res.json();
  },
  async addToCart(productId, quantity = 1) {
    const res = await fetch('/api/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, quantity })
    });
    return res.json();
  },
  async updateCartItem(productId, quantity) {
    const res = await fetch('/api/cart', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, quantity })
    });
    return res.json();
  },
  async removeCartItem(productId) {
    const res = await fetch(`/api/cart/${productId}`, { method: 'DELETE' });
    return res.json();
  },
  async placeOrder(payload) {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to place order');
    return data;
  },
  async getOrder(id) {
    const res = await fetch(`/api/orders/${id}`);
    if (!res.ok) throw new Error('Order not found');
    return res.json();
  }
};

function showToast(message) {
  let toast = document.getElementById('global-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'global-toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 2200);
}

async function refreshCartCount() {
  try {
    const cart = await api.getCart();
    const el = document.getElementById('cart-count');
    if (el) el.textContent = cart.itemCount;
  } catch (e) {
    /* silent */
  }
}

function money(n) {
  return Number(n).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Wire up header search on every page
document.addEventListener('DOMContentLoaded', () => {
  refreshCartCount();

  const searchForm = document.getElementById('header-search-form');
  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = document.getElementById('header-search-input').value.trim();
      window.location.href = `/index.html${q ? '?search=' + encodeURIComponent(q) : ''}`;
    });
  }
});
