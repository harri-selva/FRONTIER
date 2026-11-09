/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#2a1747',
        paper: '#fff8ef',
        cream: '#f6ead8',
        night: '#24164f',
        plum: '#3b2577',
        lilac: '#b8a1ff',
        pink: '#ff7cc6',
        peach: '#ffb48f',
        mint: '#74e0c0',
        butter: '#ffe07a',
        sky: '#8fd3ff',
        tomato: '#ff5d73',
        leaf: '#2f9e6e',
      },
      fontFamily: {
        display: ['Grandstander', '"Comic Sans MS"', 'ui-rounded', 'system-ui', 'sans-serif'],
        body: ['Lexend', 'ui-rounded', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
