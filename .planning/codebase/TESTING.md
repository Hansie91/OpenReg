# Testing Patterns

**Analysis Date:** 2026-01-29

## Test Framework

**Frontend Runner:**
- Vitest 1.2.0 - TypeScript and React testing
- Config: `frontend/vitest.config.ts`
- Environment: jsdom (browser-like DOM simulation)
- Setup file: `frontend/src/test/setup.ts`

**Frontend Assertion Library:**
- Vitest built-in expect API
- `@testing-library/react` 14.2.0 for component queries
- `@testing-library/jest-dom` 6.4.0 for DOM matchers
- `@testing-library/user-event` 14.5.0 for user interactions

**Backend Runner:**
- pytest 7.4.0
- Config: `backend/pyproject.toml` with `[tool.pytest.ini_options]`
- Async support: pytest-asyncio 0.23.0 in auto mode (`asyncio_mode = "auto"`)

**Backend Assertion Library:**
- pytest built-in assertions
- Custom fixtures in `backend/tests/conftest.py`

**Run Commands:**

Frontend:
```bash
npm test                # Run all tests in watch mode
npm run test:run        # Run tests once
npm run test:coverage   # Run tests with coverage report
```

Backend:
```bash
pytest                  # Run all tests
pytest -m unit          # Run unit tests only
pytest -m integration   # Run integration tests only
pytest --cov            # Run with coverage
```

## Test File Organization

**Frontend Location:**
- Co-located with source: `src/pages/Login.tsx` → `src/pages/Login.test.tsx`
- Utilities: `src/test/utils.tsx`, `src/test/setup.ts`, `src/test/mocks/`

**Frontend Naming:**
- Pattern: `{Component}.test.tsx` or `{module}.test.ts`
- Examples: `Login.test.tsx`, `api.test.ts`, `authStore.test.ts`

**Backend Location:**
- Separate directory: `backend/tests/`
- Organized by module being tested

**Backend Naming:**
- Pattern: `test_{module}.py` (preferred) or `{module}_test.py`
- Examples: `test_auth_service.py`, `test_validation_engine.py`, `test_api_keys_service.py`

**Backend Configuration (`pyproject.toml`):**
```
testpaths = ["tests"]
python_files = ["test_*.py", "*_test.py"]
python_functions = ["test_*"]
python_classes = ["Test*"]
```

## Test Structure

**Frontend Suite Organization (`Login.test.tsx`):**
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../test/utils';
import Login from './Login';
import { useAuthStore } from '../store/authStore';

describe('Login Page', () => {
    beforeEach(() => {
        // Reset store and mocks
        useAuthStore.setState({ ... });
        localStorage.clear();
        mockNavigate.mockClear();
    });

    describe('Rendering', () => {
        it('should render login form', () => {
            render(<Login />);
            expect(screen.getByRole('heading', { name: /openregreport portal/i })).toBeInTheDocument();
        });
    });

    describe('Form Validation', () => {
        it('should require email field', async () => {
            const user = userEvent.setup();
            render(<Login />);
            const emailInput = screen.getByLabelText(/email address/i);
            await user.type(screen.getByLabelText(/password/i), 'password123');
            await user.click(screen.getByRole('button', { name: /sign in/i }));
            expect(emailInput).toBeInvalid();
        });
    });
});
```

**Frontend Patterns:**

1. **beforeEach reset:** Clean state before each test
   ```typescript
   beforeEach(() => {
       useAuthStore.setState({ user: null, accessToken: null, ... });
       localStorage.clear();
       mockNavigate.mockClear();
   });
   ```

2. **Describe blocks:** Group related tests by feature/concern
   ```typescript
   describe('Login Page', () => {
       describe('Rendering', () => { ... });
       describe('Form Validation', () => { ... });
       describe('Form Submission', () => { ... });
   });
   ```

3. **User event setup:** Initialize user event for interactions
   ```typescript
   const user = userEvent.setup();
   await user.type(input, 'value');
   await user.click(button);
   ```

4. **waitFor for async:** Poll until condition met or timeout
   ```typescript
   await waitFor(() => {
       expect(mockNavigate).toHaveBeenCalledWith('/');
   });
   ```

**Backend Suite Organization (`test_auth_service.py`):**
```python
import pytest
from unittest.mock import Mock, patch

class TestPasswordHashing:
    """Tests for password hashing and verification."""

    def test_hash_password_returns_hash(self):
        """Hash should return a different string than input."""
        password = "securepassword123"
        hashed = hash_password(password)
        assert hashed != password
        assert len(hashed) > 0

    def test_verify_password_correct_password(self):
        """Correct password should verify successfully."""
        password = "securepassword123"
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True

class TestJWTTokenCreation:
    """Tests for JWT token creation."""

    @patch("services.auth.settings")
    @patch("services.auth.generate_jti")
    def test_create_access_token_returns_tuple(self, mock_jti, mock_settings):
        """Access token creation should return (token, jti, expires_at)."""
        mock_settings.SECRET_KEY = "test-secret-key"
        mock_jti.return_value = "test-jti-123"

        data = {"sub": "user-123", "tenant_id": "tenant-123"}
        token, jti, expires_at = create_access_token(data)

        assert isinstance(token, str)
        assert jti == "test-jti-123"
```

**Backend Patterns:**

1. **Test classes:** Group related tests with descriptive class names
   ```python
   class TestPasswordHashing:
       """Tests for password hashing and verification."""
   ```

2. **Single responsibility:** One assertion focus per test method
   ```python
   def test_verify_password_incorrect_password(self):
       """Incorrect password should fail verification."""
       password = "securepassword123"
       wrong_password = "wrongpassword"
       hashed = hash_password(password)
       assert verify_password(wrong_password, hashed) is False
   ```

3. **Descriptive names:** Test name describes the scenario and expected outcome
   ```python
   def test_hash_password_different_results_for_same_input(self):
       """Same password should produce different hashes (due to salt)."""
   ```

## Mocking

**Frontend Framework:** Vitest built-in `vi` module

**Frontend Mock Patterns:**

1. **Mock react-router:**
   ```typescript
   const mockNavigate = vi.fn();
   vi.mock('react-router-dom', async () => {
       const actual = await vi.importActual('react-router-dom');
       return {
           ...actual,
           useNavigate: () => mockNavigate,
       };
   });
   ```

2. **Reset mocks between tests:**
   ```typescript
   beforeEach(() => {
       mockNavigate.mockClear();
   });
   ```

3. **Verify mock calls:**
   ```typescript
   expect(mockNavigate).toHaveBeenCalledWith('/');
   expect(mockNavigate).not.toHaveBeenCalled();
   ```

**Backend Framework:** unittest.mock (pytest-mock 3.12.0)

**Backend Mock Patterns:**

1. **Patch decorators for dependencies:**
   ```python
   @patch("services.auth.settings")
   @patch("services.auth.generate_jti")
   def test_create_access_token_returns_tuple(self, mock_jti, mock_settings):
       mock_settings.SECRET_KEY = "test-secret-key"
       mock_jti.return_value = "test-jti-123"
   ```

2. **Mock spec for type safety:**
   ```python
   rule = Mock(spec=models.ValidationRule)
   rule.id = uuid4()
   rule.expression = "df['amount'] > 0"
   ```

3. **Mock HTTP exceptions:**
   ```python
   with pytest.raises(HTTPException) as exc_info:
       decode_token(invalid_token)
   assert exc_info.value.status_code == 401
   ```

**What to Mock:**
- External API calls (HTTP requests)
- Authentication/authorization calls (when testing other logic)
- Datetime/time-dependent functions (use `freezegun`)
- Settings/configuration (via `@patch` decorator)
- Expensive operations (database at higher test levels)

**What NOT to Mock:**
- Core business logic functions
- Data validation rules
- Database models (use test fixtures instead)
- Password hashing (test the actual implementation)

## Fixtures and Factories

**Frontend Test Data Factories (`frontend/src/test/utils.tsx`):**

```typescript
export const createMockUser = (overrides = {}) => ({
    id: 'user-123',
    email: 'test@example.com',
    full_name: 'Test User',
    tenant_id: 'tenant-123',
    is_superuser: false,
    ...overrides,
});

export const createMockTokens = (overrides = {}) => ({
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    ...overrides,
});

export const createMockReport = (overrides = {}) => ({
    id: 'report-123',
    name: 'Test Report',
    description: 'A test report',
    is_active: true,
    tenant_id: 'tenant-123',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
});
```

**Frontend Custom Render Wrapper (`frontend/src/test/utils.tsx`):**

```typescript
const createTestQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                cacheTime: 0,
                staleTime: 0,
            },
            mutations: {
                retry: false,
            },
        },
    });

const AllTheProviders = ({ children }: AllTheProvidersProps) => {
    const queryClient = createTestQueryClient();
    return (
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>{children}</BrowserRouter>
        </QueryClientProvider>
    );
};

const customRender = (
    ui: ReactElement,
    options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });
```

**Frontend Global Setup (`frontend/src/test/setup.ts`):**

```typescript
import '@testing-library/jest-dom';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './mocks/server';

// Start MSW server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));

// Reset handlers after each test
afterEach(() => server.resetHandlers());

// Clean up after all tests
afterAll(() => server.close());

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value.toString(); },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; },
    };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });
```

**Backend Fixtures (`backend/tests/conftest.py`):**

Database/Session fixtures:
```python
@pytest.fixture(scope="function")
def test_engine():
    """Create an in-memory SQLite database for testing."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def db_session(test_engine) -> Generator[Session, None, None]:
    """Create a database session for testing."""
    TestingSessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=test_engine
    )
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()
```

User fixtures:
```python
@pytest.fixture
def test_user(db_session: Session, test_tenant: models.Tenant) -> models.User:
    """Create a regular test user."""
    user = models.User(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        email="testuser@example.com",
        hashed_password=hash_password("testpass123"),
        full_name="Test User",
        is_active=True,
        is_superuser=False,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture
def admin_user(db_session: Session, test_tenant: models.Tenant) -> models.User:
    """Create an admin (superuser) test user."""
    user = models.User(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        email="admin@example.com",
        hashed_password=hash_password("admin123"),
        full_name="Admin User",
        is_active=True,
        is_superuser=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user
```

Auth header fixtures:
```python
@pytest.fixture
def auth_headers(test_user: models.User) -> Dict[str, str]:
    """Generate auth headers for a regular user."""
    token_data = {"sub": str(test_user.id), "tenant_id": str(test_user.tenant_id)}
    access_token, _, _ = create_access_token(token_data)
    return {"Authorization": f"Bearer {access_token}"}

@pytest.fixture
def admin_auth_headers(admin_user: models.User) -> Dict[str, str]:
    """Generate auth headers for an admin user."""
    token_data = {"sub": str(admin_user.id), "tenant_id": str(admin_user.tenant_id)}
    access_token, _, _ = create_access_token(token_data)
    return {"Authorization": f"Bearer {access_token}"}
```

**Fixture Location:**
- Frontend: `frontend/src/test/utils.tsx` (factories only)
- Backend: `backend/tests/conftest.py` (pytest fixtures)

## Coverage

**Frontend Requirements:**
- No specific coverage target enforced
- Config in `vitest.config.ts`: provider v8, reporters: text, json, html
- Excludes: node_modules, src/test/, *.d.ts, *.config.*, index.ts

**Backend Requirements:**
- No specific coverage target enforced
- Config in `pyproject.toml`:
  ```
  [tool.coverage.run]
  source = ["services", "api", "core"]
  branch = true
  omit = ["tests/*", "*/__pycache__/*", "*/migrations/*"]
  ```

**View Coverage:**

Frontend:
```bash
npm run test:coverage  # Generates HTML report in coverage/
```

Backend:
```bash
pytest --cov=services,api,core --cov-report=html
```

## Test Types

**Frontend Unit Tests:**
- Scope: Individual components and hooks
- Approach: Render component with minimal props, verify output
- Example: `Login.test.tsx` tests form rendering, validation, submission
- No API calls (mocked via MSW)

**Frontend Integration Tests:**
- Scope: Multiple components working together through providers
- Approach: Render with QueryClientProvider, BrowserRouter
- Example: Login flow with navigation and auth store updates
- MSW intercepts API calls

**Backend Unit Tests:**
- Scope: Service layer functions (auth, validation, etc.)
- Approach: Mock external dependencies, test logic
- Example: `test_auth_service.py` tests password hashing, JWT creation
- Database mocked or in-memory SQLite

**Backend Integration Tests:**
- Scope: API endpoints with real database
- Approach: Use TestClient, create actual DB records
- Markers: `@pytest.mark.integration`
- Fixtures: `client`, `db_session`, `test_user`, `auth_headers`

**E2E Tests:**
- Status: Not used
- Potential: Could use Playwright for end-to-end browser testing

## Common Patterns

**Frontend Async Testing:**

```typescript
it('should successfully login with valid credentials', async () => {
    const user = userEvent.setup();
    render(<Login />);

    await user.type(screen.getByLabelText(/email address/i), 'admin@example.com');
    await user.type(screen.getByLabelText(/password/i), 'admin123');

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);

    await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
});
```

**Frontend Error Testing:**

```typescript
it('should display error message on invalid credentials', async () => {
    const user = userEvent.setup();
    render(<Login />);

    await user.type(screen.getByLabelText(/email address/i), 'invalid@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrongpassword');

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);

    await waitFor(() => {
        expect(screen.getByText(/incorrect email or password/i)).toBeInTheDocument();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
});
```

**Backend Error Testing:**

```python
@patch("services.auth.settings")
def test_decode_token_expired_raises_error(self, mock_settings):
    """Expired token should raise HTTPException."""
    mock_settings.SECRET_KEY = "test-secret-key"
    mock_settings.JWT_ALGORITHM = "HS256"

    payload = {
        "sub": "user-123",
        "type": "access",
        "exp": datetime.utcnow() - timedelta(hours=1),
        "iat": datetime.utcnow() - timedelta(hours=2),
    }
    token = jwt.encode(payload, mock_settings.SECRET_KEY, algorithm="HS256")

    with pytest.raises(HTTPException) as exc_info:
        decode_token(token)

    assert exc_info.value.status_code == 401
    assert "expired" in exc_info.value.detail.lower()
```

**Backend State Testing:**

```python
def test_authenticate_user_valid_credentials(self, db_session, test_user):
    """Valid credentials should return user."""
    user = authenticate_user(db_session, "testuser@example.com", "testpass123")

    assert user is not None
    assert user.email == "testuser@example.com"
```

**Backend Permission Testing:**

```python
def test_has_permission_wildcard_pattern(self, db_session, test_user, test_tenant):
    """Wildcard pattern permission should match specific permissions."""
    role = models.Role(
        tenant_id=test_tenant.id,
        name="Report Manager",
        permissions=["report:*"]
    )
    db_session.add(role)
    db_session.commit()

    user_role = models.UserRole(
        user_id=test_user.id,
        role_id=role.id
    )
    db_session.add(user_role)
    db_session.commit()

    assert has_permission(test_user, db_session, "report:read") is True
    assert has_permission(test_user, db_session, "report:create") is True
```

---

*Testing analysis: 2026-01-29*
