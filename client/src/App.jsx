import { BrowserRouter } from 'react-router-dom';

import AppProviders from './app/providers.jsx';
import AppRoutes from './app/router.jsx';
import ErrorBoundary from './components/common/ErrorBoundary.jsx';

export const App = () => (
  <ErrorBoundary>
    <BrowserRouter>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </BrowserRouter>
  </ErrorBoundary>
);

export default App;
