# Coding Conventions

**Analysis Date:** 2026-01-29

## Naming Patterns

**Files:**
- TypeScript/React: PascalCase for components (`Login.tsx`, `Dashboard.tsx`), camelCase for services/utilities (`authStore.ts`, `api.ts`)
- Python: snake_case for all files (`auth.py`, `validation_engine.py`, `conftest.py`)
- Test files: Suffixed with `.test.ts`, `.test.tsx`, `test_*.py`, or `*_test.py`

**Functions:**
- TypeScript/React: camelCase (`handleSubmit`, `formatDate`, `createMockUser`, `refreshAccessToken`)
- Python: snake_case (`hash_password`, `verify_password`, `create_access_token`, `decode_token`)

**Variables:**
- TypeScript/React: camelCase for all variables (`accessToken`, `isAuthenticated`, `errorMessage`)
- Python: snake_case (`access_token`, `is_authenticated`, `error_message`)
- Constants: UPPER_SNAKE_CASE in Python (`ACCESS_TOKEN_EXPIRE_MINUTES`, `JWT_ALGORITHM`)
- React hooks: Custom hooks prefixed with `use` (`useAuthStore`, `useQuery`)

**Types:**
- TypeScript: PascalCase for types and interfaces (`TokenResponse`, `LoginRequest`, `AllTheProvidersProps`)
- Python Pydantic models: PascalCase (`LoginRequest`, `TokenResponse`, `UserResponse`)
- Python service classes: PascalCase (`ValidationEngine`, `AuthService`)

## Code Style

**Formatting:**
- Frontend: TypeScript 5.3.3 with ESLint 8.56.0 (strict mode, unused disable directives)
- Backend: Python 3.10+ (type hints expected)
- Build command: `tsc && vite build` for frontend (type-checked before bundling)
- Lint command: `eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0` (zero warnings allowed)

**Linting:**
- Frontend ESLint plugins: `@typescript-eslint/eslint-plugin`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`
- Python: pytest with type checking in docstrings

## Import Organization

**TypeScript/React Order:**
1. External libraries (React, react-router, axios, zustand, react-query)
2. Internal API services (`../services/api`)
3. Internal stores (`../store/authStore`)
4. Internal utilities/components (`../test/utils`, `../pages/Login`)
5. Type definitions (imported as `import type` when possible)

**Python Order:**
1. Standard library (`datetime`, `typing`, `uuid`)
2. Third-party packages (`fastapi`, `sqlalchemy`, `pydantic`, `pytest`)
3. Application modules (relative imports from services, models, database)

**Path Aliases:**
- Frontend: `@` maps to `./src/` (configured in `vitest.config.ts` and Vite)

**Example TypeScript imports:**
```typescript
import { useState } from 'react';
import { useQuery } from 'react-query';
import axios from 'axios';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { render } from '../test/utils';
```

**Example Python imports:**
```python
from datetime import datetime, timedelta
from typing import Optional, List, Tuple
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

from database import get_db
from services.auth import hash_password, verify_password
import models
```

## Error Handling

**TypeScript/React Patterns:**
- Try-catch blocks for async operations (e.g., API calls)
- Error messages extracted from response: `err.response?.data?.detail || 'default message'`
- Error state management through component state and store updates
- HTTP errors trigger logout and state reset in auth interceptors

**Python Patterns:**
- HTTPException with status codes and detail messages: `raise HTTPException(status_code=401, detail="Unauthorized")`
- Custom exception classes: `TokenExpiredError`, `TokenRevokedError`, `TokenInvalidError`
- Database session rollback in finally blocks: `session.rollback()` and `session.close()`
- Mock objects for exception testing in pytest

**Example error handling:**

TypeScript:
```typescript
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
```

Python:
```python
try:
    decoded = decode_token(token, expected_type="access")
    return decoded
except ExpiredSignatureError:
    raise HTTPException(status_code=401, detail="Token expired")
except JWTError:
    raise HTTPException(status_code=401, detail="Invalid token")
```

## Logging

**Framework:**
- Frontend: `console` object (development only, no production logger configured)
- Backend: Built-in Python logging with structured messages in docstrings

**Patterns:**
- Backend docstrings describe what function does, not implementation details
- Database operations logged implicitly through SQLAlchemy
- Authentication events tracked through token models in database

**Example docstring:**
```python
"""
Create a JWT access token with enhanced security claims.

Args:
    data: Token payload data (must include 'sub' for user ID)
    expires_delta: Optional custom expiration time

Returns:
    Tuple of (token, jti, expires_at) for tracking purposes
"""
```

## Comments

**When to Comment:**
- Business logic that isn't obvious from variable names
- Security considerations (e.g., token validation, encryption)
- Complex conditional logic or state management
- Workarounds or temporary solutions (prefix with `TODO`, `FIXME`, `HACK`)

**JSDoc/TSDoc:**
- Used in TypeScript for helper functions in components
- Function signatures include parameter types via TypeScript

**Python Documentation:**
- Module-level docstrings describe test suite purpose
- Test class docstrings summarize what's being tested
- Test method docstrings describe single test case behavior

**Example Python test docstring:**
```python
def test_hash_password_different_results_for_same_input(self):
    """Same password should produce different hashes (due to salt)."""
    password = "securepassword123"
    hash1 = hash_password(password)
    hash2 = hash_password(password)

    # Bcrypt uses random salt, so hashes should differ
    assert hash1 != hash2
```

## Function Design

**Size:**
- Prefer small, focused functions (under 30 lines)
- Helper functions extracted when logic is reusable (e.g., `formatDate`, `getPreviousBusinessDate`)

**Parameters:**
- TypeScript: Typed parameters with optional fields marked: `(overrides = {})`
- Python: Type hints required (`data: dict`, `expires_delta: Optional[timedelta]`)
- Destructuring used for objects: `const { access_token, refresh_token, expires_in, user } = response.data`

**Return Values:**
- Python service functions return tuples for multiple values: `Tuple[str, str, datetime]`
- TypeScript helpers return typed values: `(): string`, `(): Date`
- Mock factory functions return objects with defaults: `(overrides = {}) => ({ ...defaults, ...overrides })`

**Example service function:**
```python
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> Tuple[str, str, datetime]:
    """..."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    jti = generate_jti()
    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "access",
        "jti": jti,
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
    })
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt, jti, expire
```

## Module Design

**Exports:**
- TypeScript: Default export for React components; named exports for utilities and hooks
  - `export default function Dashboard() {}`
  - `export { customRender as render };`
  - `export * from '@testing-library/react';`
- Python: All public functions and classes exported directly from modules

**Barrel Files:**
- Frontend: `src/test/utils.tsx` re-exports testing utilities and mock factories
- Python: No barrel files used; imports go directly to service modules

**Example barrel file pattern (`frontend/src/test/utils.tsx`):**
```typescript
export * from '@testing-library/react';
export { customRender as render };
export const createMockUser = (overrides = {}) => ({ ... });
export const createMockTokens = (overrides = {}) => ({ ... });
```

---

*Convention analysis: 2026-01-29*
