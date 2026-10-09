import '@atlaskit/css-reset';
import { view } from '@forge/bridge';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

// Sync Atlassian design tokens (light/dark) with the host product theme.
void view.theme.enable();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
