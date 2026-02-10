# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

```
finanzas-ve
├─ eslint.config.js
├─ index.html
├─ package-lock.json
├─ package.json
├─ public
│  ├─ icon-192.png
│  ├─ icon-512.png
│  ├─ manifest.json
│  └─ vite.svg
├─ README.md
├─ src
│  ├─ App.css
│  ├─ App.jsx
│  ├─ assets
│  │  └─ react.svg
│  ├─ components
│  │  ├─ AddAccount.jsx
│  │  ├─ AddTransaction.jsx
│  │  ├─ AuthGuard.jsx
│  │  ├─ BottomNav.jsx
│  │  ├─ EditAccount.jsx
│  │  ├─ EditTransaction.jsx
│  │  └─ PinScreen.jsx
│  ├─ context
│  │  ├─ AuthContext.jsx
│  │  ├─ ExchangeRateContext.jsx
│  │  ├─ OfflineContext.jsx
│  │  └─ UIContext.jsx
│  ├─ index.css
│  ├─ main.jsx
│  ├─ pages
│  │  ├─ AccountDetails.jsx
│  │  ├─ Accounts.jsx
│  │  ├─ Analytics.jsx
│  │  ├─ Home.jsx
│  │  └─ Settings.jsx
│  ├─ supabaseClient.js
│  └─ utils
│     └─ offlineManager.js
├─ supabase
│  ├─ .temp
│  │  ├─ cli-latest
│  │  ├─ gotrue-version
│  │  ├─ pooler-url
│  │  ├─ postgres-version
│  │  ├─ project-ref
│  │  ├─ rest-version
│  │  ├─ storage-migration
│  │  └─ storage-version
│  ├─ config.toml
│  └─ functions
│     └─ send-monthly-report
│        ├─ .npmrc
│        ├─ deno.json
│        └─ index.ts
├─ vercel.json
└─ vite.config.js

```