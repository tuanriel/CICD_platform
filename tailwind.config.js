/** @type {import('tailwindcss').Config} */
// Design tokens are CSS custom properties (see src/index.css) so that the
// dark/light themes — toggled via [data-theme] — stay the single source of truth.
// Tailwind utilities below map onto those variables: e.g. `bg-panel`,
// `text-text-2`, `text-accent`, `border-border-strong`, `rounded-md`, `font-mono`.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        'bg-subtle': 'var(--bg-subtle)',
        panel: {
          DEFAULT: 'var(--panel)',
          2: 'var(--panel-2)',
          3: 'var(--panel-3)',
        },
        border: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)',
        },
        text: {
          DEFAULT: 'var(--text)',
          2: 'var(--text-2)',
          3: 'var(--text-3)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          fg: 'var(--accent-fg)',
          dim: 'var(--accent-dim)',
          border: 'var(--accent-border)',
        },
        green: { DEFAULT: 'var(--green)', dim: 'var(--green-dim)' },
        red: { DEFAULT: 'var(--red)', dim: 'var(--red-dim)' },
        amber: { DEFAULT: 'var(--amber)', dim: 'var(--amber-dim)' },
        blue: { DEFAULT: 'var(--blue)', dim: 'var(--blue-dim)' },
        violet: { DEFAULT: 'var(--violet)', dim: 'var(--violet-dim)' },
        code: 'var(--code-bg)',
      },
      borderRadius: {
        sm: 'var(--r-sm)',
        md: 'var(--r-md)',
        lg: 'var(--r-lg)',
        xl: 'var(--r-xl)',
      },
      fontFamily: {
        sans: 'var(--font-sans)',
        mono: 'var(--font-mono)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      keyframes: {
        spin: { to: { transform: 'rotate(360deg)' } },
        'pulse-dot': { '0%,100%': { opacity: '1' }, '50%': { opacity: '.35' } },
        'fade-up': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'scale-in': { from: { opacity: '0', transform: 'scale(.97) translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        barfill: { from: { width: '0' } },
      },
      animation: {
        spin: 'spin .8s linear infinite',
        'pulse-dot': 'pulse-dot 1.1s infinite',
        'fade-up': 'fade-up .32s cubic-bezier(.2,.7,.3,1) both',
        'fade-in': 'fade-in .3s ease both',
        'scale-in': 'scale-in .18s cubic-bezier(.2,.7,.3,1)',
      },
    },
  },
  plugins: [],
};
