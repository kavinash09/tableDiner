# TableDiner Customer Web (`@tablediner/customer-web`)

The mobile-first React/Vite front-end designed specifically for dine-in guests. Diners access this application by scanning a physical QR code on their table. It allows them to browse the menu, add items to their cart, place orders, track kitchen status, and pay the final bill.

## 🚀 Getting Started (Development)

Run the dev server from the monorepo root:
```bash
pnpm dev
```
Or to run this specific app:
```bash
cd apps/customer-web
pnpm dev
```
*(Runs on `http://localhost:5173`. Access a table by passing the `qr` query parameter: `http://localhost:5173/?qr=table-1`)*

## ⚙️ Environment Variables

Create a `.env.local` file:
```env
VITE_API_URL=http://localhost:3001
```
*(Never hardcode `localhost` in the source files. Always use this environment variable.)*

## 📂 Key Files & Architecture

- `src/App.tsx` — The main routing logic and Context provider wrapper.
- `src/components/TableSessionContext.tsx` — Manages the state of the active dining session, polling the API to stay synchronized with the kitchen.
- `src/components/Menu.tsx` — Renders the categories and items in a mobile-optimized layout.

## 📱 Mobile-First Note
This UI is heavily optimized for vertical phone layouts using standard Tailwind flexbox constraints. Desktop views expand gracefully but retain focus on a central single-column flow.
