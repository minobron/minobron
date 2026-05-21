/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Indigo — colore principale
        primary: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        // Surface — sfondo app dark (stile Linear)
        surface: {
          DEFAULT: '#0d0d14',   // bg base assoluto
          1: '#111118',         // card principale
          2: '#1a1a26',         // card elevata / modale
          3: '#252534',         // input / tag
          4: '#2e2e42',         // hover / border
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'card':  '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
        'modal': '0 25px 50px rgba(0,0,0,0.6)',
        'glow':  '0 0 20px rgba(99,102,241,0.15)',
      },
      animation: {
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in':  'fadeIn  0.2s ease-out',
        'scale-in': 'scaleIn 0.15s ease-out',
      },
      keyframes: {
        slideUp:  { '0%': { transform: 'translateY(12px)', opacity: 0 }, '100%': { transform: 'translateY(0)', opacity: 1 } },
        fadeIn:   { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        scaleIn:  { '0%': { transform: 'scale(0.95)', opacity: 0 }, '100%': { transform: 'scale(1)', opacity: 1 } },
      }
    }
  },
  plugins: []
}
