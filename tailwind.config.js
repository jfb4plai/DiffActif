import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    join(__dirname, 'index.html'),
    join(__dirname, 'src/**/*.{js,jsx}'),
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0fdf9',
          100: '#ccfbef',
          200: '#99f6df',
          300: '#5eeac8',
          400: '#2dd4aa',
          500: '#14b88a',
          600: '#0a9370',
          700: '#0c765b',
          800: '#0e5e49',
          900: '#0e4e3d',
        },
        accent: {
          100: '#ffedd5',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea6c0c',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    }
  },
  plugins: []
}
