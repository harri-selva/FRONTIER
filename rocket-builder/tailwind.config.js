/** @type {import('tailwindcss').Config} */
/*
 * FRONTIER 32-colour palette. The old paper-theme names are kept as aliases so
 * existing class names restyle in place (paper → panel navy, butter → gold, …).
 * `ink` is a CSS variable: cream on dark panels, near-black on bright chips.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'rgb(var(--ink-rgb) / <alpha-value>)',
        paper: '#141a3f',
        cream: '#fff4c2',
        night: '#05060f',
        plum: '#3d2a7a',
        lilac: '#a98be0',
        pink: '#f06aa8',
        peach: '#f28c28',
        mint: '#5fd3c8',
        butter: '#ffc94a',
        sky: '#39d0e8',
        tomato: '#e04a3a',
        leaf: '#9ad25a',
        // FRONTIER names
        void: '#05060f',
        navy0: '#0b0e2a',
        navy1: '#141a3f',
        navy2: '#1e2557',
        indigo: '#2b2f73',
        violet: '#7b46b5',
        magenta: '#c13b8a',
        gold: '#ffc94a',
        cyan: '#39d0e8',
        teal: '#1c8a9e',
        slate: '#4a5378',
        slatelight: '#8a94b8',
      },
      fontFamily: {
        title: ['"Press Start 2P"', 'ui-monospace', 'monospace'],
        display: ['"Pixelify Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['"Pixelify Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['VT323', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
