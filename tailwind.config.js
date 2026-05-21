/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: { 50:'#eef2ff', 100:'#e0e7ff', 200:'#c7d2fe', 300:'#a5b4fc', 400:'#818cf8', 500:'#6366f1', 600:'#4f46e5', 700:'#4338ca', 800:'#3730a3', 900:'#312e81' },
        rose:    { pastel: '#fde8ec' },
        amber:   { pastel: '#fef3c7' },
        emerald: { pastel: '#d1fae5' },
        sky:     { pastel: '#e0f2fe' },
        violet:  { pastel: '#ede9fe' },
        pink:    { pastel: '#fce7f3' },
        teal:    { pastel: '#ccfbf1' },
        orange:  { pastel: '#ffedd5' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      borderRadius: { '2xl': '1rem', '3xl': '1.5rem' },
      animation: {
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
      },
      keyframes: {
        slideUp: { '0%': { transform: 'translateY(100%)', opacity: 0 }, '100%': { transform: 'translateY(0)', opacity: 1 } },
        fadeIn:  { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
      }
    }
  },
  plugins: []
}
