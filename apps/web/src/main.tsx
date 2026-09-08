import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import './index.css';

const root = document.querySelector('#root');

if (!root) {
  throw new Error('Application root element was not found.');
}

const applicationRoot = createRoot(root);
if (
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).has('physics1-lab')
) {
  void import('./physics1-lab').then(({ Physics1Lab }) => {
    applicationRoot.render(
      <StrictMode>
        <Physics1Lab />
      </StrictMode>,
    );
  });
} else {
  applicationRoot.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
