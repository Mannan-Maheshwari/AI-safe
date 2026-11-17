export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#050505', panel: '#0B0D12', card: '#11141B', line: '#242936',
        ink: '#F5F7FA', muted: '#9299A5',
        neon: '#39FF14', cyber: '#00A3FF', hot: '#FF2E93', warn: '#FFB020', danger: '#FF4545',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
