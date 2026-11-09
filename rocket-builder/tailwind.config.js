/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#0d0221',
        night: '#1a0b3d',
        plum: '#2a1259',
        grape: '#3d1a78',
        neon: '#ff4fd8',
        neonsoft: '#ff9cee',
        cyber: '#5ee7ff',
        sunset: '#ffb86b',
        haze: '#e9ddff',
        ok: '#7dffb0',
        bad: '#ff6b8b',
      },
      fontFamily: {
        display: ['"Press Start 2P"', 'monospace'],
        mono: ['VT323', 'monospace'],
        body: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        neon: '0 0 0 2px #ff4fd8, 0 0 18px rgba(255,79,216,.55)',
        cyber: '0 0 0 2px #5ee7ff, 0 0 18px rgba(94,231,255,.45)',
      },
    },
  },
  plugins: [],
};
