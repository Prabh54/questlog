import { lazy, Suspense } from 'react';
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  useLocation,
} from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { useAuth } from '../features/auth/useAuth';

// Public pages — eager (tiny)
import LoginPage from '../pages/public/LoginPage';
import RegisterPage from '../pages/public/RegisterPage';
import LandingPage from '../pages/public/LandingPage';

// Protected pages — lazy loaded
const DashboardPage = lazy(() => import('../features/dashboard/DashboardPage'));
const QuestsPage = lazy(() => import('../pages/protected/QuestsPage'));
const QuestDetailPage = lazy(() => import('../pages/protected/QuestDetailPage'));
const QuestFormPage = lazy(() => import('../pages/protected/QuestFormPage'));
const ProfilePage = lazy(() => import('../features/profile/ProfilePage'));
const HistoryPage = lazy(() => import('../features/history/HistoryPage'));
const AnalyticsPage = lazy(() => import('../features/analytics/AnalyticsPage'));

function PageLoader() {
  return (
    <div className="flex h-48 items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-surface-700 border-t-primary-500" />
    </div>
  );
}

function RequireAuth() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <PageLoader />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <Outlet />;
}

function RedirectIfAuthed() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <PageLoader />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

export const router = createBrowserRouter([
  // Public (redirect to dashboard if already logged in)
  {
    element: <RedirectIfAuthed />,
    children: [
      { path: '/', element: <LandingPage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
    ],
  },

  // Protected — wrapped in AppShell + auth guard
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          {
            path: '/dashboard',
            element: (
              <Suspense fallback={<PageLoader />}>
                <DashboardPage />
              </Suspense>
            ),
          },
          {
            path: '/quests',
            element: (
              <Suspense fallback={<PageLoader />}>
                <QuestsPage />
              </Suspense>
            ),
          },
          {
            path: '/quests/new',
            element: (
              <Suspense fallback={<PageLoader />}>
                <QuestFormPage />
              </Suspense>
            ),
          },
          {
            path: '/quests/:id',
            element: (
              <Suspense fallback={<PageLoader />}>
                <QuestDetailPage />
              </Suspense>
            ),
          },
          {
            path: '/quests/:id/edit',
            element: (
              <Suspense fallback={<PageLoader />}>
                <QuestFormPage />
              </Suspense>
            ),
          },
          {
            path: '/history',
            element: (
              <Suspense fallback={<PageLoader />}>
                <HistoryPage />
              </Suspense>
            ),
          },
          {
            path: '/analytics',
            element: (
              <Suspense fallback={<PageLoader />}>
                <AnalyticsPage />
              </Suspense>
            ),
          },
          {
            path: '/profile',
            element: (
              <Suspense fallback={<PageLoader />}>
                <ProfilePage />
              </Suspense>
            ),
          },
        ],
      },
    ],
  },

  // Catch-all
  { path: '*', element: <Navigate to="/" replace /> },
]);
