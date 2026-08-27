import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#0b1220',
        navy2: '#121b2e',
        card: '#161f33',
        border: '#232d45',
        red: '#ff4d4f',
        orange: '#ff8a3d',
        muted: '#9aa5b8',
      },
    },
  },
  plugins: [],
};

export default config;
