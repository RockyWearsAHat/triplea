import type { ReactNode } from 'react';
import { colors, spacing, typography } from '../theme';

interface AppShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function AppShell({ title, subtitle, children }: AppShellProps) {
  const root: React.CSSProperties = {
    minHeight: '100vh',
    background: `radial-gradient(circle at top, ${colors.primary}22, transparent 55%), ${colors.background}`,
    color: colors.text,
    fontFamily: typography.fontFamily,
    padding: spacing.lg,
    display: 'flex',
    justifyContent: 'center',
  };

  const container: React.CSSProperties = {
    width: '100%',
    maxWidth: 960,
  };

  const header: React.CSSProperties = {
    marginBottom: spacing.xl,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: 0.4,
  };

  const subtitleStyle: React.CSSProperties = {
    marginTop: spacing.sm,
    color: colors.textMuted,
    maxWidth: 520,
  };

  return (
    <div style={root}>
      <div style={container}>
        <header style={header}>
          <h1 style={titleStyle}>{title}</h1>
          {subtitle ? <p style={subtitleStyle}>{subtitle}</p> : null}
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}