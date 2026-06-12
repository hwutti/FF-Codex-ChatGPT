/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        fire: {
          50:  '#fdf3f3',
          100: '#fbe4e4',
          200: '#f8cccc',
          300: '#f2a8a8',
          400: '#e97575',
          500: '#dc4c4c',
          600: '#c93535',
          700: '#a82828',
          800: '#8c2323',
          900: '#751f1f',
          950: '#3f0c0c',
        },
        gold: {
          400: '#d4a843',
          500: '#c49a2e',
          600: '#a87d1e',
        },
        surface: {
          DEFAULT: '#f8f7f5',
          50:  '#faf9f7',
          100: '#f3f1ee',
          200: '#e8e4df',
        },
        ink: {
          DEFAULT: '#1a1614',
          light: '#2d2724',
          muted: '#6b6460',
          faint: '#9c9490',
        },
      },
      fontFamily: {
        display: ['Outfit', 'system-ui', 'sans-serif'],
        body: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(26,22,20,0.06), 0 4px 16px rgba(26,22,20,0.04)',
        'card-hover': '0 4px 12px rgba(26,22,20,0.10), 0 8px 32px rgba(26,22,20,0.06)',
        'sidebar': '4px 0 24px rgba(26,22,20,0.15)',
        'modal': '0 20px 60px rgba(26,22,20,0.25)',
        'btn': '0 1px 2px rgba(26,22,20,0.12), inset 0 1px 0 rgba(255,255,255,0.08)',
      },
    },
  },
  plugins: [],
}
