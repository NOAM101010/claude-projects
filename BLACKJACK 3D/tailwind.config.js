/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        felt: '#0e5a2b',
        gold: '#d4af37',
      },
      fontFamily: {
        display: ['Cinzel', 'serif'],
      },
    },
  },
  plugins: [],
}
