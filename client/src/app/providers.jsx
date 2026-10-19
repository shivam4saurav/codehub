import { QueryClientProvider } from '@tanstack/react-query';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useState } from 'react';

import { AuthProvider } from '../context/AuthContext.jsx';
import { ThemeProvider } from '../context/ThemeContext.jsx';
import { ToastProvider } from '../context/ToastContext.jsx';
import createQueryClient from './queryClient.js';

/** One place that wires every cross-cutting provider, in dependency order. */
export const AppProviders = ({ children }) => {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <Tooltip.Provider delayDuration={200} skipDelayDuration={400}>
              {children}
            </Tooltip.Provider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default AppProviders;
