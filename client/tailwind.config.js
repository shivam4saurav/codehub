/** @type {import('tailwindcss').Config} */

/** Theme-aware colour: the RGB triplet lives in a CSS variable in index.css. */
const themed = (variable) => `rgb(var(${variable}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        // One family, two cuts: Plex Sans for reading, Plex Mono for anything
        // you compare at a glance (ratings, ids, countdowns, counts).
        display: ['"IBM Plex Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        sans: ['"IBM Plex Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
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
        /**
         * The accent is "Accepted" green, the colour every judge uses for a
         * correct submission. 100-300 are text shades and switch per theme for
         * contrast; 400-900 are fills and stay fixed.
         */
        brand: {
          50: '#eef8f1',
          100: themed('--brand-100'),
          200: themed('--brand-200'),
          300: themed('--brand-300'),
          400: '#3fae6f',
          500: '#2b9a5c',
          600: '#1f7f4b',
          700: '#186a3e',
          800: '#145533',
          900: '#0f4128',
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
      // Tighter corners than the usual "everything is a pill" look.
      borderRadius: {
        lg: '0.375rem',
        xl: '0.5rem',
        '2xl': '0.625rem',
        '3xl': '0.75rem',
      },
      boxShadow: {
        card: '0 1px 0 rgb(0 0 0 / 0.03)',
        overlay: '0 12px 32px -12px rgb(0 0 0 / 0.35), 0 2px 6px rgb(0 0 0 / 0.08)',
        glow: '0 0 0 1px rgb(var(--edge-strong))',
        'glow-cyan': '0 0 0 1px rgb(var(--edge-strong))',
        inset: 'inset 0 1px 0 0 rgb(255 255 255 / 0.04)',
      },
      backgroundImage: {
        // Kept as names so existing classes still resolve; both are flat now.
        'brand-gradient': 'linear-gradient(#1f7f4b, #1f7f4b)',
        'brand-gradient-soft': 'linear-gradient(rgb(31 127 75 / 0.08), rgb(31 127 75 / 0.08))',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
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
        'fade-up': 'fade-up 0.15s ease-out both',
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
