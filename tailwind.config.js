/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        industrial: {
          black: '#000000',
          900: '#0a0a0a',
          800: '#0f0f0f',
          700: '#1a1a1a',
          600: '#333333',
          500: '#4a4a4a',
          400: '#666666',
          300: '#999999',
          200: '#cccccc',
          100: '#ffffff',
        },
        accent: {
          cyan: '#00FFFF',
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};