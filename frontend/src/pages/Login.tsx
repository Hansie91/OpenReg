import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authAPI } from '../services/api';
import { useFormValidation, validators } from '../hooks/useFormValidation';
import { FormField } from '../components/FormField';

export default function Login() {
    const navigate = useNavigate();
    const login = useAuthStore((state) => state.login);
    const [serverError, setServerError] = useState('');

    const form = useFormValidation({
        initialValues: {
            email: '',
            password: '',
        },
        rules: {
            email: [
                validators.required('Email is required'),
                validators.email('Please enter a valid email address'),
            ],
            password: [
                validators.required('Password is required'),
                validators.minLength(6, 'Password must be at least 6 characters'),
            ],
        },
        onSubmit: async (values) => {
            setServerError('');
            try {
                const response = await authAPI.login(values.email, values.password);
                const { access_token, refresh_token, expires_in, user } = response.data;
                login(access_token, refresh_token, expires_in, user);
                navigate('/');
            } catch (err: any) {
                setServerError(err.response?.data?.detail || 'Login failed. Please try again.');
            }
        },
    });

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="w-full max-w-sm mx-4">
                {/* Card */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    {/* Logo */}
                    <div className="text-center mb-6">
                        <div className="inline-flex items-center justify-center w-10 h-10 bg-slate-900 rounded mb-3">
                            <span className="text-white font-semibold text-sm">OR</span>
                        </div>
                        <h1 className="text-base font-semibold text-gray-900">
                            OpenRegReport
                        </h1>
                        <p className="mt-1 text-xs text-gray-500">
                            Sign in to your account
                        </p>
                    </div>

                    <form onSubmit={form.handleSubmit} className="space-y-4">
                        {serverError && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-xs">
                                {serverError}
                            </div>
                        )}

                        <FormField
                            label="Email"
                            type="email"
                            placeholder="you@example.com"
                            required
                            {...form.getFieldProps('email')}
                        />

                        <FormField
                            label="Password"
                            type="password"
                            placeholder="Enter password"
                            required
                            {...form.getFieldProps('password')}
                        />

                        <button
                            type="submit"
                            disabled={form.isSubmitting || form.hasErrors}
                            className="btn btn-primary w-full py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {form.isSubmitting ? (
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
                    <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="bg-gray-50 rounded p-3 text-center">
                            <p className="text-xs font-medium text-gray-600 mb-1">
                                Demo Credentials
                            </p>
                            <div className="text-xs text-gray-500 space-y-0.5">
                                <p>admin@example.com / admin123</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <p className="mt-4 text-center text-xs text-gray-400">
                    OpenRegReport v0.1.0
                </p>
            </div>
        </div>
    );
}
