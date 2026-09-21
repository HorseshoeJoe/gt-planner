/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Phase 2 accessibility work: the brand palette was darkened so text on
        // coloured surfaces clears the WCAG AA 4.5:1 contrast ratio.
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          600: '#1d4ed8',
          700: '#1e40af',
          800: '#1e3a8a',
        },
      },
      minHeight: {
        // 44px - the minimum comfortable touch target on mobile.
        touch: '2.75rem',
      },
    },
  },
  plugins: [],
};
