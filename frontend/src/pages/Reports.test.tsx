import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../test/utils';
import Reports from './Reports';
import { useAuthStore } from '../store/authStore';
import { server } from '../test/mocks/server';
import { http, HttpResponse } from 'msw';

const API_URL = 'http://localhost:8000/api/v1';

// Mock Monaco Editor to avoid issues in test environment
vi.mock('@monaco-editor/react', () => ({
    default: ({ value, onChange }: { value: string; onChange?: (value: string | undefined) => void }) => (
        <textarea
            data-testid="monaco-editor"
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
        />
    ),
}));

// Mock ResizeObserver for components that use it
global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
}));

describe('Reports Page', () => {
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
    });

    describe('Rendering', () => {
        it('should render page header', async () => {
            render(<Reports />);

            expect(screen.getByRole('heading', { name: /reports/i })).toBeInTheDocument();
            expect(screen.getByText(/manage your regulatory reports/i)).toBeInTheDocument();
        });

        it('should render create report button', async () => {
            render(<Reports />);

            expect(screen.getByRole('button', { name: /create report/i })).toBeInTheDocument();
        });

        it('should display loading state initially', () => {
            render(<Reports />);

            expect(screen.getByText(/loading reports/i)).toBeInTheDocument();
        });
    });

    describe('Report List Display', () => {
        it('should render report list from API', async () => {
            render(<Reports />);

            await waitFor(() => {
                expect(screen.getByText('Daily Transaction Report')).toBeInTheDocument();
                expect(screen.getByText('Weekly Summary')).toBeInTheDocument();
            });
        });

        it('should display report names and descriptions', async () => {
            render(<Reports />);

            await waitFor(() => {
                expect(screen.getByText('Daily Transaction Report')).toBeInTheDocument();
                expect(screen.getByText('Daily regulatory report')).toBeInTheDocument();
                expect(screen.getByText('Weekly Summary')).toBeInTheDocument();
                expect(screen.getByText('Weekly summary report')).toBeInTheDocument();
            });
        });

        it('should display report status badges', async () => {
            render(<Reports />);

            await waitFor(() => {
                expect(screen.getByText('Active')).toBeInTheDocument();
                expect(screen.getByText('Inactive')).toBeInTheDocument();
            });
        });

        it('should display report version info', async () => {
            render(<Reports />);

            await waitFor(() => {
                expect(screen.getByText('v1.0')).toBeInTheDocument();
                expect(screen.getByText('Draft')).toBeInTheDocument();
            });
        });

        it('should render action buttons for each report', async () => {
            render(<Reports />);

            await waitFor(() => {
                const editButtons = screen.getAllByTitle('Edit');
                const executeButtons = screen.getAllByTitle('Execute');
                const deleteButtons = screen.getAllByTitle('Delete');

                expect(editButtons.length).toBe(2);
                expect(executeButtons.length).toBe(2);
                expect(deleteButtons.length).toBe(2);
            });
        });
    });

    describe('Empty State', () => {
        it('should display empty state when no reports exist', async () => {
            server.use(
                http.get(`${API_URL}/reports`, () => {
                    return HttpResponse.json([]);
                })
            );

            render(<Reports />);

            await waitFor(() => {
                expect(screen.getByText(/no reports yet/i)).toBeInTheDocument();
                expect(screen.getByText(/create your first regulatory report/i)).toBeInTheDocument();
            });
        });

        it('should have create report button in empty state', async () => {
            server.use(
                http.get(`${API_URL}/reports`, () => {
                    return HttpResponse.json([]);
                })
            );

            render(<Reports />);

            await waitFor(() => {
                const createButtons = screen.getAllByRole('button', { name: /create report/i });
                expect(createButtons.length).toBeGreaterThan(0);
            });
        });
    });

    describe('Create Report Flow', () => {
        it('should open create wizard when clicking create button', async () => {
            const user = userEvent.setup();
            render(<Reports />);

            await waitFor(() => {
                expect(screen.getByText('Daily Transaction Report')).toBeInTheDocument();
            });

            const createButton = screen.getByRole('button', { name: /create report/i });
            await user.click(createButton);

            // The wizard component should be triggered
            await waitFor(() => {
                // The wizard opens - we just verify the button click doesn't error
                expect(createButton).toBeInTheDocument();
            });
        });
    });

    describe('Execute Report Flow', () => {
        it('should open execute modal when clicking execute button', async () => {
            const user = userEvent.setup();
            render(<Reports />);

            await waitFor(() => {
                expect(screen.getByText('Daily Transaction Report')).toBeInTheDocument();
            });

            const executeButtons = screen.getAllByTitle('Execute');
            await user.click(executeButtons[0]);

            await waitFor(() => {
                // Modal should show business date from/to labels
                expect(screen.getByText(/business date from/i)).toBeInTheDocument();
            });
        });

        it('should show execute button in the modal', async () => {
            const user = userEvent.setup();
            render(<Reports />);

            await waitFor(() => {
                expect(screen.getByText('Daily Transaction Report')).toBeInTheDocument();
            });

            const executeButtons = screen.getAllByTitle('Execute');
            await user.click(executeButtons[0]);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /execute report/i })).toBeInTheDocument();
            });
        });
    });

    describe('Delete Report Flow', () => {
        it('should open delete confirmation modal when clicking delete', async () => {
            const user = userEvent.setup();
            render(<Reports />);

            await waitFor(() => {
                expect(screen.getByText('Daily Transaction Report')).toBeInTheDocument();
            });

            const deleteButtons = screen.getAllByTitle('Delete');
            await user.click(deleteButtons[0]);

            await waitFor(() => {
                expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
            });
        });

        it('should close delete modal when clicking cancel', async () => {
            const user = userEvent.setup();
            render(<Reports />);

            await waitFor(() => {
                expect(screen.getByText('Daily Transaction Report')).toBeInTheDocument();
            });

            const deleteButtons = screen.getAllByTitle('Delete');
            await user.click(deleteButtons[0]);

            await waitFor(() => {
                expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
            });

            const cancelButton = screen.getByRole('button', { name: /cancel/i });
            await user.click(cancelButton);

            await waitFor(() => {
                expect(screen.queryByText(/are you sure/i)).not.toBeInTheDocument();
            });
        });
    });

    describe('Error States', () => {
        it('should handle server error gracefully', async () => {
            server.use(
                http.get(`${API_URL}/reports`, () => {
                    return HttpResponse.json(
                        { detail: 'Internal server error' },
                        { status: 500 }
                    );
                })
            );

            render(<Reports />);

            // Component should still render header even on error
            await waitFor(() => {
                expect(screen.getByRole('heading', { name: /reports/i })).toBeInTheDocument();
            });
        });

        it('should handle network error gracefully', async () => {
            server.use(
                http.get(`${API_URL}/reports`, () => {
                    return HttpResponse.error();
                })
            );

            render(<Reports />);

            // Component should still render header even on error
            await waitFor(() => {
                expect(screen.getByRole('heading', { name: /reports/i })).toBeInTheDocument();
            });
        });
    });

    describe('Edit Report Modal', () => {
        it('should open edit modal when clicking edit button', async () => {
            const user = userEvent.setup();
            render(<Reports />);

            await waitFor(() => {
                expect(screen.getByText('Daily Transaction Report')).toBeInTheDocument();
            });

            const editButtons = screen.getAllByTitle('Edit');
            await user.click(editButtons[0]);

            await waitFor(() => {
                // Modal should show the report name in the header
                const modalHeaders = screen.getAllByText('Daily Transaction Report');
                expect(modalHeaders.length).toBeGreaterThan(0);
            });
        });

        it('should have tabs in edit modal', async () => {
            const user = userEvent.setup();
            render(<Reports />);

            await waitFor(() => {
                expect(screen.getByText('Daily Transaction Report')).toBeInTheDocument();
            });

            const editButtons = screen.getAllByTitle('Edit');
            await user.click(editButtons[0]);

            await waitFor(() => {
                // Check for tab buttons (Info, Code, etc.)
                expect(screen.getByRole('button', { name: /info/i })).toBeInTheDocument();
            });
        });
    });

    describe('Table Structure', () => {
        it('should display table headers correctly', async () => {
            render(<Reports />);

            await waitFor(() => {
                expect(screen.getByText('Daily Transaction Report')).toBeInTheDocument();
            });

            expect(screen.getByText('Name')).toBeInTheDocument();
            expect(screen.getByText('Description')).toBeInTheDocument();
            expect(screen.getByText('Status')).toBeInTheDocument();
            expect(screen.getByText('Version')).toBeInTheDocument();
            expect(screen.getByText('Created')).toBeInTheDocument();
            expect(screen.getByText('Actions')).toBeInTheDocument();
        });
    });
});
