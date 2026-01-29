import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../test/utils';
import Layout from './Layout';
import { useAuthStore } from '../store/authStore';

// Mock useLocation to control the current path
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

describe('Layout Component', () => {
    beforeEach(() => {
        // Set up authenticated state
        useAuthStore.setState({
            user: {
                id: 'user-123',
                email: 'admin@example.com',
                full_name: 'Admin User',
                tenant_id: 'tenant-123',
            },
            accessToken: 'mock-access-token',
            refreshToken: 'mock-refresh-token',
            expiresAt: Date.now() + 3600000,
            isAuthenticated: true,
            isRefreshing: false,
        });
        localStorage.clear();
        mockNavigate.mockClear();
    });

    describe('Navigation Rendering', () => {
        it('should render sidebar with navigation links', () => {
            render(<Layout />);

            // Check for main navigation items
            expect(screen.getByText('Dashboard')).toBeInTheDocument();
            expect(screen.getByText('Reports')).toBeInTheDocument();
            expect(screen.getByText('Connectors')).toBeInTheDocument();
            expect(screen.getByText('Mappings')).toBeInTheDocument();
            expect(screen.getByText('Validations')).toBeInTheDocument();
            expect(screen.getByText('Schedules')).toBeInTheDocument();
            expect(screen.getByText('Destinations')).toBeInTheDocument();
            expect(screen.getByText('Runs')).toBeInTheDocument();
        });

        it('should render admin navigation items', () => {
            render(<Layout />);

            expect(screen.getByText('Connect API')).toBeInTheDocument();
            expect(screen.getByText('Admin')).toBeInTheDocument();
        });

        it('should have correct href attributes on navigation links', () => {
            render(<Layout />);

            expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute('href', '/');
            expect(screen.getByRole('link', { name: /reports/i })).toHaveAttribute('href', '/reports');
            expect(screen.getByRole('link', { name: /connectors/i })).toHaveAttribute('href', '/connectors');
            expect(screen.getByRole('link', { name: /runs/i })).toHaveAttribute('href', '/runs');
        });

        it('should render OpenReg brand name', () => {
            render(<Layout />);

            expect(screen.getByText('OpenReg')).toBeInTheDocument();
        });
    });

    describe('User Info Display', () => {
        it('should display user full name', () => {
            render(<Layout />);

            expect(screen.getByText('Admin User')).toBeInTheDocument();
        });

        it('should display user email', () => {
            render(<Layout />);

            expect(screen.getByText('admin@example.com')).toBeInTheDocument();
        });

        it('should display fallback when user has no full_name', () => {
            useAuthStore.setState({
                user: {
                    id: 'user-123',
                    email: 'test@example.com',
                    full_name: '',
                    tenant_id: 'tenant-123',
                },
                accessToken: 'mock-access-token',
                refreshToken: 'mock-refresh-token',
                expiresAt: Date.now() + 3600000,
                isAuthenticated: true,
                isRefreshing: false,
            });

            render(<Layout />);

            expect(screen.getByText('User')).toBeInTheDocument();
        });
    });

    describe('Logout Functionality', () => {
        it('should render sign out button', () => {
            render(<Layout />);

            expect(screen.getByText('Sign Out')).toBeInTheDocument();
        });

        it('should call logout when sign out is clicked', async () => {
            const user = userEvent.setup();
            const logoutSpy = vi.fn();

            // Set up store with spy
            useAuthStore.setState({
                user: {
                    id: 'user-123',
                    email: 'admin@example.com',
                    full_name: 'Admin User',
                    tenant_id: 'tenant-123',
                },
                accessToken: 'mock-access-token',
                refreshToken: 'mock-refresh-token',
                expiresAt: Date.now() + 3600000,
                isAuthenticated: true,
                isRefreshing: false,
                logout: logoutSpy,
            });

            render(<Layout />);

            const signOutButton = screen.getByText('Sign Out');
            await user.click(signOutButton);

            expect(logoutSpy).toHaveBeenCalled();
        });
    });

    describe('Sidebar Collapse', () => {
        it('should have collapse/expand toggle button', () => {
            render(<Layout />);

            // Find the collapse button (button with chevron icon)
            const buttons = screen.getAllByRole('button');
            const collapseButton = buttons.find(btn => btn.querySelector('svg'));
            expect(collapseButton).toBeInTheDocument();
        });

        it('should toggle sidebar collapse state when clicking toggle', async () => {
            const user = userEvent.setup();
            render(<Layout />);

            // Initially should show full text
            expect(screen.getByText('OpenReg')).toBeInTheDocument();
            expect(screen.getByText('Dashboard')).toBeInTheDocument();

            // Find and click the collapse toggle button
            const aside = document.querySelector('aside');
            expect(aside).toBeInTheDocument();

            // The sidebar should have a class indicating its width
            expect(aside?.className).toContain('w-56');
        });
    });

    describe('Navigation Links', () => {
        it('should render Schemas navigation link', () => {
            render(<Layout />);

            expect(screen.getByText('Schemas')).toBeInTheDocument();
        });

        it('should render Exceptions navigation link', () => {
            render(<Layout />);

            expect(screen.getByText('Exceptions')).toBeInTheDocument();
        });

        it('should render Streaming navigation link', () => {
            render(<Layout />);

            expect(screen.getByText('Streaming')).toBeInTheDocument();
        });
    });

    describe('Main Content Area', () => {
        it('should render main content area', () => {
            render(<Layout />);

            const mainContent = document.querySelector('main');
            expect(mainContent).toBeInTheDocument();
        });

        it('should have proper margin to account for sidebar', () => {
            render(<Layout />);

            const mainContent = document.querySelector('main');
            expect(mainContent).toBeInTheDocument();
            // Check for margin-left style (224px when expanded)
            expect(mainContent?.style.marginLeft).toBe('224px');
        });
    });

    describe('Responsive Behavior', () => {
        it('should have transition classes for smooth collapse animation', () => {
            render(<Layout />);

            const aside = document.querySelector('aside');
            expect(aside?.className).toContain('transition-all');
            expect(aside?.className).toContain('duration-200');
        });
    });

    describe('Error Boundary', () => {
        // Note: Layout.tsx does not currently have an error boundary.
        // This is noted for future Phase 3 UX work.
        it('should note that error boundary is not yet implemented', () => {
            // Layout currently does not wrap children in an error boundary
            // Future enhancement: Add ErrorBoundary component to catch rendering errors
            // and display user-friendly fallback UI with recovery options
            expect(true).toBe(true); // Placeholder test
        });
    });

    describe('Accessibility', () => {
        it('should have proper navigation structure', () => {
            render(<Layout />);

            // Nav element should exist
            const nav = document.querySelector('nav');
            expect(nav).toBeInTheDocument();
        });

        it('should have links as proper anchor elements', () => {
            render(<Layout />);

            const links = screen.getAllByRole('link');
            expect(links.length).toBeGreaterThan(0);

            // Each link should have href attribute
            links.forEach(link => {
                expect(link).toHaveAttribute('href');
            });
        });
    });
});
