# Contributing to PriceSentinel

Thank you for your interest in contributing to PriceSentinel!

## Prerequisites

- Node.js 18+
- Python 3.11+
- Chrome or Chromium
- Git

## Setup

Clone the repository:

```bash
git clone https://github.com/AshayK003/PriceSentinel.git
cd PriceSentinel
```

Install and run the frontend:

```bash
npm install
npm run dev
```

Set up the backend:

```bash
cd backend
python -m venv .venv
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Running Tests

```bash
# Frontend
npm test

# Backend
cd backend
pytest tests/ -v
```

## Code Style

- Follow the existing project style.
- Use Python type hints where appropriate.
- Do not hardcode secrets.
- Keep commits focused and descriptive.

## Pull Request Process

1. Fork the repository.
2. Create a branch:
   ```bash
   git checkout -b fix/your-feature
   ```
3. Make your changes and run the tests.
4. Commit and push your branch.
5. Open a Pull Request referencing the related issue.

## Reporting Issues

Check existing issues before creating a new one:

https://github.com/AshayK003/PriceSentinel/issues