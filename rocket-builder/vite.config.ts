/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { DIFFICULTY_SETS } from './src/data/difficulty-sets';

/**
 * The committed snapshot (src/data/planets.json) holds every planet the archive
 * returned. The game only needs the curated destinations, so this plugin trims
 * the JSON at import time. The full snapshot stays in the repository.
 */
function curatedPlanets(): Plugin {
  const keep = new Set(Object.values(DIFFICULTY_SETS).flat());
  return {
    name: 'curated-planets',
    enforce: 'pre',
    transform(code, id) {
      if (!id.replace(/\\/g, '/').endsWith('/src/data/planets.json')) return null;
      const data = JSON.parse(code) as { planets: { pl_name: string }[] };
      const trimmed = { ...data, planets: data.planets.filter((p) => keep.has(p.pl_name)) };
      // Still JSON: Vite's JSON plugin turns it into a module afterwards.
      return { code: JSON.stringify(trimmed), map: null };
    },
  };
}

export default defineConfig({
  plugins: [curatedPlanets(), react()],
  base: './',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
