import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from 'react-query';
import { useAuthStore } from './store/authStore';
import { useEffect, useRef } from 'react';
import { adminAPI } from './services/api';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Reports from './pages/Reports';
import Connectors from './pages/Connectors';
import Runs from './pages/Runs';
import Mappings from './pages/Mappings';
import Validations from './pages/Validations';
import Exceptions from './pages/ExceptionsPage';
import Schedules from './pages/Schedules';
import Destinations from './pages/Destinations';
import Streaming from './pages/Streaming';
import Admin from './pages/Admin';
import Schemas from './pages/Schemas';
import Layout from './components/Layout';

const queryClient = new QueryClient();

// Auto-logout hook based on admin-configured timeout
function useInactivityLogout() {
    const { isAuthenticated, logout } = useAuthStore();
    const timeoutRef = useRef<number | null>(null);

    // Fetch session timeout setting (only when authenticated)
    const { data: settings } = useQuery(
        'session-settings',
        () => adminAPI.getSettings().then(res => res.data),
        {
            enabled: isAuthenticated,
            refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
            staleTime: 5 * 60 * 1000
        }
    );

    const timeoutMinutes = settings?.session_timeout_minutes || 30;

    useEffect(() => {
        if (!isAuthenticated) return;

        const timeoutMs = timeoutMinutes * 60 * 1000;

        const resetTimer = () => {
            if (timeoutRef.current) {
                window.clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = window.setTimeout(() => {
                logout();
                window.location.href = '/login?expired=1';
            }, timeoutMs);
        };

        // Activity events to monitor
        const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

        // Add listeners
        events.forEach(event => {
            document.addEventListener(event, resetTimer, { passive: true });
        });

        // Start initial timer
        resetTimer();

        // Cleanup
        return () => {
            if (timeoutRef.current) {
                window.clearTimeout(timeoutRef.current);
            }
            events.forEach(event => {
                document.removeEventListener(event, resetTimer);
            });
        };
    }, [isAuthenticated, timeoutMinutes, logout]);
}

function AppContent() {
    const { isAuthenticated } = useAuthStore();

    // Use the inactivity logout hook
    useInactivityLogout();

    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<Login />} />

                {/* Protected routes */}
                <Route
                    path="/"
                    element={
                        isAuthenticated ? <Layout /> : <Navigate to="/login" replace />
                    }
                >
                    <Route index element={<Dashboard />} />
                    <Route path="reports" element={<Reports />} />
                    <Route path="connectors" element={<Connectors />} />
                    <Route path="runs" element={<Runs />} />
                    <Route path="mappings" element={<Mappings />} />
                    <Route path="validations" element={<Validations />} />
                    <Route path="exceptions" element={<Exceptions />} />
                    <Route path="schedules" element={<Schedules />} />
                    <Route path="destinations" element={<Destinations />} />
                    <Route path="streaming" element={<Streaming />} />
                    <Route path="schemas" element={<Schemas />} />
                    <Route path="admin" element={<Admin />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <AppContent />
        </QueryClientProvider>
    );
}

export default App;
