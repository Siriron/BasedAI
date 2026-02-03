/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cyber: {
          dark: '#0a0a0f',
          card: '#1a1a2e',
          cyan: '#00f0ff',
          magenta: '#ff00ff',
          lime: '#00ff88',
          yellow: '#ffdd00',
          pink: '#ff006e',
        },
      },
      animation: {
        'glow': 'glow 3s ease-in-out infinite',
        'float': 'float 15s ease-in-out infinite',
        'confetti': 'confetti linear forwards',
        'slideIn': 'slideIn 0.5s ease-out',
        'fadeIn': 'fadeIn 0.5s ease-out forwards',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
      },
      keyframes: {
        glow: {
          '0%, 100%': { 
            borderColor: '#00f0ff',
            boxShadow: '0 0 20px rgba(0, 240, 255, 0.5)'
          },
          '33%': { 
            borderColor: '#9d4edd',
            boxShadow: '0 0 20px rgba(157, 78, 221, 0.5)'
          },
          '66%': { 
            borderColor: '#ff00ff',
            boxShadow: '0 0 20px rgba(255, 0, 255, 0.5)'
          },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px) translateX(0px)' },
          '33%': { transform: 'translateY(-20px) translateX(10px)' },
          '66%': { transform: 'translateY(-10px) translateX(-10px)' },
        },
        confetti: {
          '0%': { transform: 'translateY(0) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateY(100vh) rotate(720deg)', opacity: '0' },
        },
        slideIn: {
          from: { transform: 'translateX(100%)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-glow': {
          '0%, 100%': { 
            boxShadow: '0 0 20px rgba(0, 240, 255, 0.4)',
            transform: 'scale(1)'
          },
          '50%': { 
            boxShadow: '0 0 40px rgba(0, 240, 255, 0.8)',
            transform: 'scale(1.02)'
          },
        },
      },
    },
  },
  plugins: [],
}
