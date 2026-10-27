/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#EEF2F8',
          100: '#D6DFEC',
          200: '#AABBD6',
          300: '#7894BC',
          400: '#4C6E9F',
          500: '#2E5182',
          600: '#1E3D68',
          700: '#152E52',
          800: '#0F2443',
          900: '#0B1F3A',
          950: '#06132A',
        },
        gold: {
          50: '#FBF6E7',
          100: '#F5E9C2',
          200: '#EBD48A',
          300: '#E0BE55',
          400: '#D4AE3B',
          500: '#C9A227',
          600: '#A8851C',
          700: '#836717',
        },
        ivory: '#FAF7F2',
        ink: '#1C2333',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 10px 30px -12px rgba(11, 31, 58, 0.18)',
        lift: '0 24px 48px -20px rgba(11, 31, 58, 0.35)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.7s ease-out both',
        float: 'float 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
