import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';

import LoadingScreen from '../components/common/LoadingScreen.jsx';
import { RequireAuth, RequireGuest } from '../components/common/RequireAuth.jsx';
import AppLayout from '../components/layout/AppLayout.jsx';
import LandingPage from '../pages/LandingPage.jsx';
import LoginPage from '../pages/LoginPage.jsx';
import NotFoundPage from '../pages/NotFoundPage.jsx';
import RegisterPage from '../pages/RegisterPage.jsx';

// Heavier, chart-driven pages load on demand to keep the landing bundle small.
const ContestsPage = lazy(() => import('../pages/ContestsPage.jsx'));
const PracticePage = lazy(() => import('../pages/PracticePage.jsx'));
const ProblemsPage = lazy(() => import('../pages/ProblemsPage.jsx'));
const ProfilePage = lazy(() => import('../pages/ProfilePage.jsx'));
const PublicProfilePage = lazy(() => import('../pages/PublicProfilePage.jsx'));
const RemindersPage = lazy(() => import('../pages/RemindersPage.jsx'));
const SettingsPage = lazy(() => import('../pages/SettingsPage.jsx'));

export const AppRoutes = () => (
  <Suspense fallback={<LoadingScreen />}>
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<LandingPage />} />

        {/* Guests can browse; signing in adds solve status, bookmarks and notes. */}
        <Route path="/problems" element={<ProblemsPage />} />

        {/* Guests can view any dashboard via ?codeforces=…&leetcode=… */}
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/practice" element={<PracticePage />} />
        <Route path="/contests" element={<ContestsPage />} />

        {/* Public, opt-in. Crawlers are served meta tags by GET /share/:username. */}
        <Route path="/u/:username" element={<PublicProfilePage />} />

        <Route
          path="/reminders"
          element={
            <RequireAuth>
              <RemindersPage />
            </RequireAuth>
          }
        />

        <Route
          path="/login"
          element={
            <RequireGuest>
              <LoginPage />
            </RequireGuest>
          }
        />
        <Route
          path="/register"
          element={
            <RequireGuest>
              <RegisterPage />
            </RequireGuest>
          }
        />

        <Route
          path="/settings"
          element={
            <RequireAuth>
              <SettingsPage />
            </RequireAuth>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  </Suspense>
);

export default AppRoutes;
