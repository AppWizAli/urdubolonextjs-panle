import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#172033',
        canvas: '#f6f7fb',
        line: '#e4e7ec',
        brand: '#d9485f',
        brandDark: '#b7384e',
        teal: '#0d9488',
        gold: '#d28b2d',
      },
      boxShadow: {
        panel: '0 8px 30px rgba(23, 32, 51, 0.06)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'ui-sans-serif', 'system-ui'],
      },
    },
  },
  plugins: [],
};

export default config;
