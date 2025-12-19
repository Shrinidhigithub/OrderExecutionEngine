// Fallback ambient declaration for `pg` if editor/tsserver doesn't pick up `@types/pg`.
// This file is intentionally minimal — the project also has `@types/pg` installed
// and the real types will be used by the compiler. This only helps editors
// that sometimes fail to load packages from `node_modules/@types`.

declare module 'pg';
