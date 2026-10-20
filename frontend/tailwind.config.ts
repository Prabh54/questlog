import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      // ── Fonts ────────────────────────────────────────────────────────────
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },

      // ── Color palette ────────────────────────────────────────────────────
      // Warm-paper theme. Raw tokens live in src/index.css as RGB channels so
      // Tailwind opacity modifiers (e.g. bg-surface-900/95) keep working.
      colors: {
        page: 'rgb(var(--page) / <alpha-value>)',
        sidebar: 'rgb(var(--sidebar) / <alpha-value>)',
        'nav-active': 'rgb(var(--nav-active) / <alpha-value>)',
        card: 'rgb(var(--card) / <alpha-value>)',
        'card-inner': 'rgb(var(--card-inner) / <alpha-value>)',
        paper: 'rgb(var(--white) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        track: 'rgb(var(--track) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        navy: 'rgb(var(--navy) / <alpha-value>)',
        flame: {
          DEFAULT: 'rgb(var(--flame) / <alpha-value>)',
          bg: 'rgb(var(--flame-bg) / <alpha-value>)',
        },
        // Accent — muted blue, anchored on --blue (#3d69b7) at 500.
        primary: {
          50: '#eef1f7',
          100: '#dde3ef',
          200: '#b9c1d5', // --blue-soft
          300: '#8fa3cc',
          400: '#5f83c4',
          500: '#3d69b7', // --blue
          600: '#3d69b7',
          700: '#2f5395',
          800: '#243f71',
          900: '#1a2d50',
          950: '#0d151f', // --navy
        },
        // Neutral surfaces. The scale is ordered so that 950 is the page
        // background and 50 is the darkest ink: components written as
        // "bg-surface-900 text-surface-50" read as card + ink.
        surface: {
          50: 'rgb(var(--ink) / <alpha-value>)',
          100: 'rgb(var(--text) / <alpha-value>)',
          200: '#34353a',
          300: '#45464c',
          400: '#5a5b61',
          500: 'rgb(var(--muted) / <alpha-value>)',
          600: '#a19f9a',
          700: 'rgb(var(--line) / <alpha-value>)',
          800: 'rgb(var(--card-inner) / <alpha-value>)',
          900: 'rgb(var(--card) / <alpha-value>)',
          950: 'rgb(var(--page) / <alpha-value>)',
        },
        // Status — sage green
        success: {
          50: '#eef3ec',
          100: '#dce7d8',
          400: '#4f7a4a',
          500: '#5c8a56',
          600: '#466f41',
          700: '#375834',
        },
        // Status — ochre
        warning: {
          50: '#f8f0e2',
          100: '#f0e0c4',
          400: '#a8681c',
          500: '#c07a26',
          600: '#9a5f19',
          700: '#7c4c14',
        },
        // Status — brick red
        danger: {
          50: '#f7e9e6',
          100: '#efd3cd',
          400: '#a8322a',
          500: '#b83a30',
          600: '#a8322a',
          700: '#8a2821',
        },
        // XP — streak orange / flame
        xp: {
          50: '#faf0e9',
          100: '#eeddd4', // --flame-bg
          400: '#d9572a', // --flame
          500: '#fd7f22', // --orange
          600: '#c24a20',
        },
      },

      // ── Spacing ──────────────────────────────────────────────────────────
      spacing: {
        18: '4.5rem',
        72: '18rem',
        84: '21rem',
        96: '24rem',
      },

      // ── Border radius ────────────────────────────────────────────────────
      borderRadius: {
        '4xl': '2rem',
      },

      // ── Box shadow ───────────────────────────────────────────────────────
      boxShadow: {
        // Soft paper shadows (formerly violet glows).
        glow: '0 1px 2px rgb(20 22 28 / 0.06), 0 4px 12px -4px rgb(20 22 28 / 0.08)',
        'glow-sm': '0 1px 2px rgb(20 22 28 / 0.08)',
      },

      // ── Animation ────────────────────────────────────────────────────────
      keyframes: {
        'slide-in': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'slide-in': 'slide-in 0.2s ease-out',
        'fade-in': 'fade-in 0.15s ease-out',
      },
    },
  },
  plugins: [forms({ strategy: 'class' })],
} satisfies Config;
