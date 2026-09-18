import { App } from '../App';

import { useTheme } from './theme-context';

export function ThemeApplication() {
  const theme = useTheme();
  return <App theme={theme} />;
}
