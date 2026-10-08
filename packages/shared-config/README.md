# Shared Config (`@tablediner/shared-config`)

Provides centralized configuration files to maintain consistency across the entire monorepo.

## 🚀 Purpose
Prevents having to maintain duplicate `tsconfig.json`, `eslint`, or `prettier` setups in every single app and package folder.

## 📂 Key Files (Pending)
- `tsconfig.base.json` — Base strict TypeScript compiler options (targeting TS ^5.2.2).
- `eslint-preset.js` — Shared linting rules to enforce code quality.

## 🛠️ Usage
In an app's `tsconfig.json`:
```json
{
  "extends": "@tablediner/shared-config/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist"
  }
}
```
