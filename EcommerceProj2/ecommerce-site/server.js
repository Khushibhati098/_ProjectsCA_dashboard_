const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Middleware ----------
app.use(bodyParser.json());
app.use(
  session({
    secret: 'shopease-secret-key-change-in-production',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 day
  })
);
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Data helpers ----------
const PRODUCTS_PATH = path.join(__dirname, 'data', 'products.json');
const ORDERS_PATH = path.join(__dirname, 'data', 'orders.json');

function getProducts() {
  return JSON.parse(fs.readFileSync(PRODUCTS_PATH, 'utf-8'));
}

function getOrders() {
  if (!fs.existsSync(ORDERS_PATH)) return [];
  return JSON.parse(fs.readFileSync(ORDERS_PATH, 'utf-8'));
}

function saveOrders(orders) {
  fs.writeFileSync(ORDERS_PATH, JSON.stringify(orders, null, 2));
}

function getCart(req) {
  if (!req.session.cart) req.session.cart = [];
  return req.session.cart;
}

// ---------- Product Routes ----------

// GET all products (supports ?category=&search=&sort=)
app.get('/api/products', (req, res) => {
  let products = getProducts();
  const { category, search, sort } = req.query;

  if (category && category !== 'All') {
    products = products.filter((p) => p.category === category);
  }
  if (search) {
    const q = search.toLowerCase();
    products = products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.shortDescription.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }
  if (sort === 'price-asc') products.sort((a, b) => a.price - b.price);
  if (sort === 'price-desc') products.sort((a, b) => b.price - a.price);
  if (sort === 'rating') products.sort((a, b) => b.rating - a.rating);

  res.json(products);
});

// GET all distinct categories
app.get('/api/categories', (req, res) => {
  const products = getProducts();
  const categories = [...new Set(products.map((p) => p.category))];
  res.json(categories);
});

// GET single product by id
app.get('/api/products/:id', (req, res) => {
  const products = getProducts();
  const product = products.find((p) => p.id === parseInt(req.params.id));
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

// ---------- Cart Routes ----------

// GET current cart (with product details + totals)
app.get('/api/cart', (req, res) => {
  const cart = getCart(req);
  const products = getProducts();

  const items = cart
    .map((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product) return null;
      return {
        productId: product.id,
        name: product.name,
        image: product.image,
        price: product.price,
        quantity: item.quantity,
        subtotal: +(product.price * item.quantity).toFixed(2)
      };
    })
    .filter(Boolean);

  const total = +items.reduce((sum, i) => sum + i.subtotal, 0).toFixed(2);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  res.json({ items, total, itemCount });
});

// POST add item to cart { productId, quantity }
app.post('/api/cart', (req, res) => {
  const { productId, quantity } = req.body;
  const qty = parseInt(quantity) || 1;
  const products = getProducts();
  const product = products.find((p) => p.id === parseInt(productId));

  if (!product) return res.status(404).json({ error: 'Product not found' });

  const cart = getCart(req);
  const existing = cart.find((i) => i.productId === product.id);

  if (existing) {
    existing.quantity += qty;
  } else {
    cart.push({ productId: product.id, quantity: qty });
  }

  res.json({ message: 'Added to cart', cart });
});

// PUT update quantity of an item { productId, quantity }
app.put('/api/cart', (req, res) => {
  const { productId, quantity } = req.body;
  const cart = getCart(req);
  const item = cart.find((i) => i.productId === parseInt(productId));

  if (!item) return res.status(404).json({ error: 'Item not in cart' });

  if (parseInt(quantity) <= 0) {
    req.session.cart = cart.filter((i) => i.productId !== parseInt(productId));
  } else {
    item.quantity = parseInt(quantity);
  }

  res.json({ message: 'Cart updated', cart: req.session.cart });
});

// DELETE remove item from cart
app.delete('/api/cart/:productId', (req, res) => {
  const cart = getCart(req);
  req.session.cart = cart.filter((i) => i.productId !== parseInt(req.params.productId));
  res.json({ message: 'Item removed', cart: req.session.cart });
});

// DELETE clear entire cart
app.delete('/api/cart', (req, res) => {
  req.session.cart = [];
  res.json({ message: 'Cart cleared' });
});

// ---------- Order Routes ----------

// POST place an order { customer: {name, email, address, city, zip}, paymentMethod }
app.post('/api/orders', (req, res) => {
  const { customer, paymentMethod } = req.body;
  const cart = getCart(req);

  if (!cart.length) return res.status(400).json({ error: 'Cart is empty' });
  if (!customer || !customer.name || !customer.email || !customer.address) {
    return res.status(400).json({ error: 'Missing required customer details' });
  }

  const products = getProducts();
  const items = cart.map((item) => {
    const product = products.find((p) => p.id === item.productId);
    return {
      productId: item.productId,
      name: product.name,
      price: product.price,
      quantity: item.quantity,
      subtotal: +(product.price * item.quantity).toFixed(2)
    };
  });

  const subtotal = +items.reduce((sum, i) => sum + i.subtotal, 0).toFixed(2);
  const shipping = subtotal > 1999 ? 0 : 79;
  const tax = +(subtotal * 0.18).toFixed(2); // GST
  const total = +(subtotal + shipping + tax).toFixed(2);

  const orders = getOrders();
  const order = {
    id: 'ORD-' + Date.now().toString().slice(-8),
    date: new Date().toISOString(),
    customer,
    paymentMethod: paymentMethod || 'Cash on Delivery',
    items,
    subtotal,
    shipping,
    tax,
    total,
    status: 'Confirmed'
  };

  orders.push(order);
  saveOrders(orders);

  // Clear the cart after successful order
  req.session.cart = [];

  res.status(201).json({ message: 'Order placed successfully', order });
});

// GET order by id (order confirmation lookup)
app.get('/api/orders/:id', (req, res) => {
  const orders = getOrders();
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

// Fallback: serve index.html for any non-API GET (simple client routing safety net)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`ShopEase server running at http://localhost:${PORT}`);
});
