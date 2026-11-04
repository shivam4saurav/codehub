/** @type {import('tailwindcss').Config} */

/** Theme-aware colour: the RGB triplet lives in a CSS variable in index.css. */
const themed = (variable) => `rgb(var(${variable}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Poppins', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        sans: ['Poppins', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['Poppins', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        surface: {
          base: themed('--surface-base'),
          raised: themed('--surface-raised'),
          overlay: themed('--surface-overlay'),
          inset: themed('--surface-inset'),
        },
        content: {
          primary: themed('--content-primary'),
          secondary: themed('--content-secondary'),
          muted: themed('--content-muted'),
          inverse: themed('--content-inverse'),
        },
        edge: {
          DEFAULT: themed('--edge'),
          strong: themed('--edge-strong'),
        },
        brand: {
          50: '#fff7ed',
          100: themed('--brand-100'),
          200: themed('--brand-200'),
          300: themed('--brand-300'),
          400: '#fb923c',
          500: '#f97316',
          600: '#c84d07',
          700: '#b13f06',
          800: '#9a3412',
          900: '#7c2d12',
        },
        accent: {
          cyan: themed('--accent-cyan'),
          lime: themed('--accent-lime'),
          amber: themed('--accent-amber'),
          rose: themed('--accent-rose'),
        },
        state: {
          success: themed('--state-success'),
          warning: themed('--state-warning'),
          danger: themed('--state-danger'),
          info: themed('--state-info'),
        },
        platform: {
          leetcode: themed('--platform-leetcode'),
          codeforces: themed('--platform-codeforces'),
          codechef: themed('--platform-codechef'),
        },
      },
      // Rounder, friendlier corners.
      borderRadius: {
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        card: '0 1px 2px rgb(16 24 40 / 0.04), 0 1px 3px rgb(16 24 40 / 0.06)',
        lift: '0 10px 24px -12px rgb(16 24 40 / 0.18), 0 2px 6px rgb(16 24 40 / 0.06)',
        overlay: '0 16px 40px -12px rgb(0 0 0 / 0.35), 0 2px 6px rgb(0 0 0 / 0.08)',
        glow: '0 0 0 4px rgb(249 115 22 / 0.15)',
        'glow-cyan': '0 0 0 1px rgb(var(--edge-strong))',
        inset: 'inset 0 1px 0 0 rgb(255 255 255 / 0.04)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)',
        'brand-gradient-soft':
          'linear-gradient(135deg, rgb(249 115 22 / 0.10), rgb(251 146 60 / 0.04))',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-left': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.25s ease-out both',
        'slide-in-left': 'slide-in-left 0.2s cubic-bezier(0.22, 1, 0.36, 1) both',
        shimmer: 'shimmer 1.6s infinite',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};
