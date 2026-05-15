import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function publicBase(): string {
  const b = process.env.VITE_PUBLIC_BASE?.trim();
  if (!b || b === '/') return '/';
  return b.endsWith('/') ? b : `${b}/`;
}

export default defineConfig({
  plugins: [react()],
  base: publicBase(),
});
