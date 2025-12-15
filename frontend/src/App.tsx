import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { useAuthStore } from './store/authStore';

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

function App() {
    const { isAuthenticated } = useAuthStore();

    return (
        <QueryClientProvider client={queryClient}>
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
        </QueryClientProvider>
    );
}

export default App;
