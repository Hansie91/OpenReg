# Contributing to OpenRegReport Portal

Thank you for your interest in contributing to OpenRegReport Portal! This document provides guidelines and information for contributors.

## 🎯 How Can You Contribute?

### 1. Code Contributions
- Implement features from the [roadmap](docs/ROADMAP.md)
- Fix bugs
- Improve performance
- Add tests
- Enhance documentation

### 2. Documentation
- Improve existing docs
- Add tutorials and examples
- Translate documentation
- Create video walkthroughs

### 3. Testing & Feedback
- Test new features
- Report bugs
- Suggest improvements
- Share use cases

### 4. Community
- Answer questions in discussions
- Help other users
- Write blog posts
- Present at conferences

## 🚀 Getting Started

### Development Environment Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/YOUR_USERNAME/openreg.git
   cd openreg
   ```

2. **Set Up Backend**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Set Up Frontend**
   ```bash
   cd frontend
   npm install
   ```

4. **Start Development Stack**
   ```bash
   docker-compose up -d postgres redis minio
   cd backend && uvicorn main:app --reload
   cd frontend && npm run dev
   ```

### Making Changes

1. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Your Changes**
   - Write clean, readable code
   - Follow existing code style
   - Add comments for complex logic
   - Update documentation

3. **Test Your Changes**
   ```bash
   # Backend tests (when available)
   cd backend && pytest
   
   # Frontend tests
   cd frontend && npm test
   
   # Manual testing
   docker-compose up -d
   ```

4. **Commit**
   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   ```

   **Commit Message Format:**
   - `feat:` New feature
   - `fix:` Bug fix
   - `docs:` Documentation changes
   - `style:` Code style changes (formatting)
   - `refactor:` Code refactoring
   - `test:` Adding tests
   - `chore:` Maintenance tasks

5. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   ```
   Then create a Pull Request on GitHub.

## 📋 Development Guidelines

### Code Style

**Python (Backend):**
- Follow PEP 8
- Use type hints
- Maximum line length: 100 characters
- Use Black for formatting (when configured)
- Document functions with docstrings

**TypeScript (Frontend):**
- Follow TypeScript best practices
- Use ESLint rules (configured in project)
- Functional components with hooks
- Proper TypeScript types (avoid `any`)

**Example:**
```python
# Python
def create_report(
    db: Session,
    name: str,
    tenant_id: uuid.UUID
) -> models.Report:
    """
    Create a new report.
    
    Args:
        db: Database session
        name: Report name
        tenant_id: Tenant UUID
        
    Returns:
        Created report instance
    """
    report = models.Report(name=name, tenant_id=tenant_id)
    db.add(report)
    db.commit()
    return report
```

### Testing

- Write tests for new features
- Maintain or improve code coverage
- Test edge cases
- Include integration tests where appropriate

**Backend Test Example:**
```python
def test_create_report(db_session, test_user):
    """Test report creation"""
    report = create_report(
        db_session,
        name="Test Report",
        tenant_id=test_user.tenant_id
    )
    assert report.name == "Test Report"
    assert report.tenant_id == test_user.tenant_id
```

### Documentation

- Update README.md if adding user-facing features
- Add docstrings to functions/classes
- Update API documentation
- Include examples in docs

### Security

- Never commit secrets or credentials
- Use environment variables for configuration
- Validate all user inputs
- Follow OWASP best practices
- Report security issues privately (security@openreg.example)

## 🔍 Code Review Process

1. **Automated Checks**
   - All tests must pass
   - Code style checks (linting)
   - No merge conflicts

2. **Manual Review**
   - Code quality and readability
   - Tests adequacy
   - Documentation completeness
   - Security considerations

3. **Feedback**
   - Address reviewer comments
   - Make requested changes
   - Re-request review

4. **Merge**
   - Approved by maintainer
   - All checks pass
   - Squash and merge

## 🎯 Priority Areas (v1)

Looking for something to work on? Check these priorities:

### High Priority
1. **Report Execution Pipeline**
   - Database connector plugins
   - Python code execution sandbox
   - Validation engine
   
2. **SFTP/FTP Delivery**
   - Paramiko SFTP implementation
   - Retry logic
   - Delivery tracking

3. **Cross-Reference Mappings**
   - Full CRUD API
   - CSV import/export
   - UI implementation

### Medium Priority
1. Monaco Editor integration
2. Schedule management UI
3. Log streaming
4. Kubernetes deployment

See [ROADMAP.md](docs/ROADMAP.md) for full list.

## 📝 Pull Request Template

When creating a PR, include:

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tests added/updated
- [ ] Manual testing performed
- [ ] All tests passing

## Checklist
- [ ] Code follows project style
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings
```

## 🐛 Reporting Bugs

Use GitHub Issues with this template:

```markdown
**Description:**
Clear description of the bug

**Steps to Reproduce:**
1. Go to '...'
2. Click on '...'
3. See error

**Expected Behavior:**
What should happen

**Actual Behavior:**
What actually happens

**Environment:**
- OS: Windows 10
- Docker version: 20.10.x
- Browser: Chrome 120

**Logs:**
```
Paste relevant logs
```

**Screenshots:**
If applicable
```

## 💡 Feature Requests

Submit feature requests via GitHub Issues:

```markdown
**Problem Statement:**
What problem does this solve?

**Proposed Solution:**
How should it work?

**Alternatives Considered:**
Other approaches?

**Additional Context:**
Use cases, examples, mockups
```

## 📜 License

By contributing, you agree that your contributions will be licensed under the Apache 2.0 License.

## 🙏 Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Credited in release notes
- Mentioned in announcement posts

## ❓ Questions?

- GitHub Discussions: For general questions
- GitHub Issues: For bugs and features
- Email: contributors@openreg.example (to be set up)

---

**Thank you for contributing to OpenRegReport Portal!** 🎉

Every contribution, no matter how small, helps make regulatory reporting easier for everyone.
