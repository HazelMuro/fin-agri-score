import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import RequireAuth from './components/RequireAuth';
import AppLayout from './layouts/AppLayout';
import DashboardPage from './pages/DashboardPage';
import FarmersPage from './pages/FarmersPage';
import FarmerOnboardingPage from './pages/FarmerOnboardingPage';
import FarmerDetailPage from './pages/FarmerDetailPage';
import ApplicationsPage from './pages/ApplicationsPage';
import ApplicationNewPage from './pages/ApplicationNewPage';
import ApplicationDetailPage from './pages/ApplicationDetailPage';
import ReportsPage from './pages/ReportsPage';
import ScoreApplicationPage from './pages/ScoreApplicationPage';
import HistoryPage from './pages/HistoryPage';
import LoginPage from './pages/LoginPage';
import AppErrorBoundary from './components/AppErrorBoundary';

export default function App() {
  return (
    <AppErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
              <Route element={<AppLayout />}>
                <Route index element={<DashboardPage />} />
                <Route path="/farmers" element={<FarmersPage />} />
                <Route path="/farmers/new" element={<FarmerOnboardingPage />} />
                <Route path="/farmers/:id" element={<FarmerDetailPage />} />
                <Route path="/applications/new" element={<ApplicationNewPage />} />
                <Route path="/applications/:id" element={<ApplicationDetailPage />} />
                <Route path="/applications" element={<ApplicationsPage />} />
                <Route path="/score" element={<ScoreApplicationPage />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  );
}
