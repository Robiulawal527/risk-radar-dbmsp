export const COLORS = {
  bg: '#050B14',
  card: '#0F172A',
  cardBorder: '#1E2937',
  text: '#F8FAFC',
  textMuted: '#94A3B8',
  accent: '#00E5FF',
  accentDark: '#00B8CC',
  danger: '#FF2E63',
  warning: '#FF9500',
  success: '#00C853',
  glass: 'rgba(15, 23, 42, 0.8)',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const RADIUS = {
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  full: 999,
};

export const SHADOWS = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  glow: {
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
  },
};

export const TYPOGRAPHY = {
  h1: { fontSize: 32, fontWeight: '800' as const, letterSpacing: -0.5 },
  h2: { fontSize: 24, fontWeight: '700' as const },
  h3: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  caption: { fontSize: 12, fontWeight: '500' as const },
  small: { fontSize: 11, fontWeight: '400' as const },
};
