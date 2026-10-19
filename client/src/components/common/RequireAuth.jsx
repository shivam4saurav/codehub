import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext.jsx';
import LoadingScreen from './LoadingScreen.jsx';

/**
 * Guards private routes. While the session is being resolved we must not
 * redirect, otherwise a refresh on a private page would bounce to /login.
 */
export const RequireAuth = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingScreen label="Checking your session…" />;

  if (!isAuthenticated) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return children;
};

/** Inverse guard: keeps signed-in users away from /login and /register. */
export const RequireGuest = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen label="Checking your session…" />;
  if (isAuthenticated) return <Navigate to="/profile" replace />;

  return children;
};

export default RequireAuth;
