// theme.js
export const DARK_THEME = {
  primary: '#3021E0',
  secondary: '#38BDF8',
  background: '#101010',
  whiteBg: '#FFFFFF',
  lightbackground: '#2E2D3B',
  card: '#1C1B26',
  border: '#3A3948',
  text: {
    primary: '#FFFFFF',
    secondary: '#A0A0A0',
  },
  accent: '#4CAF50',
  danger: '#FF4444',
  chartColors: [
    '#FF6B6B',
    '#4ECDC4',
    '#FFD93D',
    '#6C5CE7',
    '#A8E6CF',
    '#FF8B94',
    '#45B7D1',
    '#96CEB4',
    '#FFEEAD',
    '#D4A5A5',
  ],
};

export const LIGHT_THEME = {
  primary: '#3021E0',
  secondary: '#0284C7',
  background: '#F8F9FA',
  whiteBg: '#FFFFFF',
  lightbackground: '#FFFFFF',
  card: '#FFFFFF',
  border: '#E2E8F0',
  text: {
    primary: '#0F172A',
    secondary: '#64748B',
  },
  accent: '#16A34A',
  danger: '#DC2626',
  chartColors: [
    '#FF6B6B',
    '#4ECDC4',
    '#FFD93D',
    '#6C5CE7',
    '#A8E6CF',
    '#FF8B94',
    '#45B7D1',
    '#96CEB4',
    '#FFEEAD',
    '#D4A5A5',
  ],
};

export const COLORS = {
  ...DARK_THEME,
  text: { ...DARK_THEME.text },
};

export const applyTheme = (themeName) => {
  const target = themeName === 'light' ? LIGHT_THEME : DARK_THEME;
  Object.assign(COLORS, target);
  COLORS.text = { ...target.text };
};