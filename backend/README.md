# PriceSentinel — Backend

Python FastAPI server for the PriceSentinel extension.
Handles page polling, HTML diffing, change detection, and notifications.

## Setup

```bash
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
```

## Run

```bash
uvicorn main:app --reload --port 8000
```
