module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#FBFAF7',
        surface: '#FFFFFF',
        ink: '#1A1D21',
        muted: '#5B616B',
        line: '#E5E2DA',
        accent: { DEFAULT: '#1E3A5F', hover: '#162C49', soft: '#EEF2F7' },
        // One meaning per colour, used only for risk.
        risk: {
          high: '#B42318',
          'high-soft': '#FEF3F2',
          medium: '#93370D',
          'medium-soft': '#FFFAEB',
          low: '#067647',
          'low-soft': '#ECFDF3',
        },
      },
      fontFamily: {
        sans: ['Inter', '"Noto Sans Devanagari"', 'system-ui', 'sans-serif'],
        serif: ['"Source Serif 4"', '"Noto Sans Devanagari"', 'Georgia', 'serif'],
      },
      maxWidth: { prose: '42rem' },
    },
  },
  plugins: [],
};
