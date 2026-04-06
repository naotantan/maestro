/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Token-mapped colors for use in Tailwind classes
        th: {
          bg: 'var(--c-bg)',
          'bg-2': 'var(--color-bg-2)',
          'bg-3': 'var(--color-bg-3)',
          'surface-0': 'var(--c-surface-0)',
          'surface-1': 'var(--c-surface-1)',
          'surface-2': 'var(--c-surface-2)',
          'surface-3': 'var(--c-surface-3)',
          ivory: 'var(--color-ivory)',
          parchment: 'var(--color-parchment)',
          terracotta: 'var(--color-terracotta)',
          coral: 'var(--color-coral)',
          'near-black': 'var(--color-near-black)',
          'dark-surface': 'var(--color-dark-surface)',
          'warm-sand': 'var(--color-warm-sand)',
          'warm-silver': 'var(--color-warm-silver)',
          text: 'var(--c-text-primary)',
          'text-2': 'var(--c-text-secondary)',
          'text-3': 'var(--c-text-tertiary)',
          'text-4': 'var(--c-text-muted)',
          accent: 'var(--c-accent)',
          'accent-dim': 'var(--c-accent-dim)',
          'accent-hover': 'var(--c-accent-hover)',
          'accent-text': 'var(--c-accent-text)',
          border: 'var(--c-border)',
          'border-strong': 'var(--c-border-strong)',
          'border-accent': 'var(--c-border-accent)',
          success: 'var(--c-success)',
          'success-dim': 'var(--c-success-dim)',
          warning: 'var(--c-warning)',
          'warning-dim': 'var(--c-warning-dim)',
          danger: 'var(--c-danger)',
          'danger-dim': 'var(--c-danger-dim)',
          info: 'var(--c-info)',
          'info-dim': 'var(--c-info-dim)',
          overlay: 'var(--c-overlay)',
        },
      },
      borderRadius: {
        th: 'var(--radius-lg)',
        'th-sm': 'var(--radius-sm)',
        'th-md': 'var(--radius-md)',
        'th-xl': 'var(--radius-xl)',
      },
      boxShadow: {
        th: 'var(--shadow-sm)',
        'th-md': 'var(--shadow-md)',
        'th-lg': 'var(--shadow-lg)',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Noto Sans JP', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        serif: ['Georgia', 'Times New Roman', 'serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))',
        'gradient-subtle': 'linear-gradient(135deg, var(--color-surface), var(--color-bg-2))',
      },
      animation: {
        'fade-in': 'fadeIn 200ms ease forwards',
        'slide-up': 'slideUp 200ms ease forwards',
      },
      keyframes: {
        slideUp: {
          'from': { opacity: '0', transform: 'translateY(8px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
