import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authAPI } from '../services/api';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const login = useAuthStore((state) => state.login);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await authAPI.login(email, password);
            const { access_token, refresh_token, expires_in, user } = response.data;
            login(access_token, refresh_token, expires_in, user);
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-indigo-50/30 to-purple-50/30">
            {/* Background pattern */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-100 rounded-full opacity-50 blur-3xl"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-100 rounded-full opacity-50 blur-3xl"></div>
            </div>

            <div className="relative w-full max-w-md mx-4">
                {/* Card */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/50 p-8">
                    {/* Logo */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl mb-4 shadow-lg shadow-indigo-500/25">
                            <span className="text-white font-bold text-xl">OR</span>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            OpenRegReport Portal
                        </h1>
                        <p className="mt-2 text-sm text-gray-500">
                            Sign in to your account
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm animate-fade-in">
                                {error}
                            </div>
                        )}

                        <div>
                            <label htmlFor="email" className="input-label">
                                Email address
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                required
                                className="input"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="input-label">
                                Password
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                className="input"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn btn-primary w-full py-3"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <div className="spinner"></div>
                                    Signing in...
                                </span>
                            ) : (
                                'Sign in'
                            )}
                        </button>
                    </form>

                    {/* Demo credentials */}
                    <div className="mt-6 pt-6 border-t border-gray-100">
                        <div className="bg-indigo-50 rounded-lg p-4 text-center">
                            <p className="text-xs font-medium text-indigo-700 uppercase tracking-wide mb-2">
                                Demo Credentials
                            </p>
                            <div className="text-sm text-indigo-600 space-y-0.5">
                                <p><span className="text-indigo-500">Email:</span> admin@example.com</p>
                                <p><span className="text-indigo-500">Password:</span> admin123</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <p className="mt-6 text-center text-sm text-gray-400">
                    OpenRegReport Portal v0.1.0
                </p>
            </div>
        </div>
    );
}
