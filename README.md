# ShopEase — Full-Stack E-Commerce Demo

A complete, working e-commerce site: product catalog, product details, shopping cart, and order checkout — built with **Express.js (Node.js)** on the backend and plain **HTML/CSS/JavaScript** on the frontend.

## Features

- **Product listings** — 12 seeded products across 4 categories, with search, category filter, and sorting (price / rating)
- **Product details page** — full description, rating, stock level, quantity selector, add-to-cart
- **Shopping cart** — session-based (server-side), add/update/remove items, live totals
- **Order processing** — checkout form with validation, shipping/tax calculation, order stored server-side, and an order confirmation page with a real order ID you can look up again
- **Styled, responsive frontend** — a custom "general store catalog" design system (no framework/Bootstrap look), works down to mobile

## Tech Stack

- **Backend:** Node.js + Express, `express-session` for per-visitor carts, JSON file storage for products & orders (no database setup required)
- **Frontend:** Static HTML/CSS/vanilla JS calling a small REST API (`fetch`)

## Getting Started

1. **Install dependencies** (Node.js 18+ recommended):
   ```bash
   npm install
   ```

2. **Start the server:**
   ```bash
   npm start
   ```

3. **Open the site:**
   ```
   http://localhost:3000
   ```

That's it — no database, no build step, no environment variables required.

## Project Structure

```
ecommerce-site/
├── server.js               # Express app: all API routes (products, cart, orders)
├── package.json
├── data/
│   └── products.json       # Seed product catalog (edit/add products here)
│   └── orders.json         # Created automatically once the first order is placed
└── public/                 # Static frontend
    ├── index.html          # Home / product listing page
    ├── product.html         # Product details page (?id=<productId>)
    ├── cart.html            # Shopping cart page
    ├── checkout.html        # Checkout form (shipping + payment)
    ├── order-confirmation.html  # Order confirmation (?id=<orderId>)
    ├── css/style.css
    └── js/common.js         # Shared API helper + toast + header cart count
```

## API Reference

| Method | Endpoint              | Description                              |
|--------|-----------------------|-------------------------------------------|
| GET    | `/api/products`       | List products (`?category=`, `?search=`, `?sort=price-asc|price-desc|rating`) |
| GET    | `/api/categories`     | List distinct categories                  |
| GET    | `/api/products/:id`   | Get a single product                      |
| GET    | `/api/cart`           | Get current session's cart with totals    |
| POST   | `/api/cart`           | Add item `{ productId, quantity }`        |
| PUT    | `/api/cart`           | Update quantity `{ productId, quantity }` |
| DELETE | `/api/cart/:productId`| Remove one item                           |
| DELETE | `/api/cart`           | Clear the cart                            |
| POST   | `/api/orders`         | Place an order `{ customer, paymentMethod }` |
| GET    | `/api/orders/:id`     | Look up a placed order                    |

## Notes & Extending It

- **Cart persistence:** the cart lives in a server-side session tied to a cookie, so it survives page reloads/tabs for the same browser, but resets if you clear cookies or use a fresh browser/incognito session.
- **Payments:** the "Credit / Debit Card" and "UPI" options are recorded as the chosen payment method only — no real payment processor is integrated. Wiring in Stripe/Razorpay would be the natural next step and would only require adding a payment step inside the `/api/orders` handler in `server.js`.
- **Database:** products and orders are stored as JSON files for simplicity. To move to a real database (Postgres/MongoDB), swap out the `getProducts`/`getOrders`/`saveOrders` helpers in `server.js` for DB queries — the routes themselves won't need to change.
- **Adding products:** just add new objects to `data/products.json` following the existing shape.
