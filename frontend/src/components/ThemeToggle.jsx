import { useTheme } from '../hooks/useTheme';

const SunIcon = (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" className="theme-icon">
    <path
      fill="currentColor"
      d="M12 17.5a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11ZM12 2a1 1 0 0 1 1 1v1.2a1 1 0 0 1-2 0V3a1 1 0 0 1 1-1Zm0 17.8a1 1 0 0 1 1 1V22a1 1 0 0 1-2 0v-1.2a1 1 0 0 1 1-1ZM4.22 4.22a1 1 0 0 1 1.42 0l.85.85a1 1 0 0 1-1.42 1.42l-.85-.85a1 1 0 0 1 0-1.42Zm13.29 13.29a1 1 0 0 1 1.41 0l.85.85a1 1 0 0 1-1.41 1.41l-.85-.85a1 1 0 0 1 0-1.41ZM2 12a1 1 0 0 1 1-1h1.2a1 1 0 0 1 0 2H3a1 1 0 0 1-1-1Zm17.8 0a1 1 0 0 1 1-1H22a1 1 0 0 1 0 2h-1.2a1 1 0 0 1-1-1ZM4.22 19.78a1 1 0 0 1 0-1.41l.85-.85a1 1 0 0 1 1.42 1.41l-.85.85a1 1 0 0 1-1.42 0Zm13.29-13.29a1 1 0 0 1 0-1.42l.85-.85a1 1 0 0 1 1.41 1.42l-.85.85a1 1 0 0 1-1.41 0Z"
    />
  </svg>
);

const MoonIcon = (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" className="theme-icon">
    <path
      fill="currentColor"
      d="M21 13.3A8.5 8.5 0 0 1 10.7 3a1 1 0 0 0-1.3-1.1 10 10 0 1 0 12.7 12.7 1 1 0 0 0-1.1-1.3Z"
    />
  </svg>
);

export default function ThemeToggle({ compact = false }) {
  const { theme, toggleTheme } = useTheme();
  const nextLabel = theme === 'dark' ? 'Light mode' : 'Dark mode';
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={`Switch to ${nextLabel}`}
      title={`Switch to ${nextLabel}`}
    >
      {theme === 'dark' ? SunIcon : MoonIcon}
    </button>
  );
}
