# AI Internship Application Agent

A full-stack internship assistant that helps candidates manage their profile, upload and parse resumes, discover relevant internships, analyze skill gaps, generate cover letters, and track applications.

## Features

- User registration, login, profile management, and password updates
- JWT-based authentication for protected operations
- Resume upload and text extraction from PDF and DOCX files
- Internship browsing with search, domain, and work-mode filters
- Resume-based internship matching using a RAG pipeline and FAISS index
- Skill-gap analysis for a selected internship
- AI-generated cover letters with selectable tone
- Internship application tracking and status updates
- Interactive API documentation through FastAPI

## Technology Stack

- **Backend:** Python, FastAPI, SQLAlchemy, MySQL
- **Authentication:** JWT and bcrypt
- **Resume processing:** pypdf and python-docx
- **Matching:** FAISS, sentence-transformers, and scikit-learn
- **Optional AI features:** Google Gemini API
- **Frontend:** React, React Router, Axios, Lucide React, and Vite

## Project Structure

```text
.
├── app/                 # FastAPI application, models, schemas, and routers
├── data/                # Internship data and matching index
├── frontend/            # React/Vite client
├── uploads/             # Runtime resume uploads; ignored by Git
├── database.py          # Database connection helper
├── requirements.txt     # Python dependencies
└── test_db.py           # MySQL connection check
```

## Prerequisites

Install the following before setup:

- Python 3.10 or newer
- Node.js and npm
- MySQL Server
- Git

## Backend Setup

From the project root, create and activate a virtual environment:

### Windows PowerShell

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

Install the Python dependencies:

```powershell
pip install -r requirements.txt
```

Create a MySQL database:

```sql
CREATE DATABASE resume_api_db;
```

Copy the example environment file and update the values for your machine:

```powershell
Copy-Item .env.example .env
```

At minimum, set `DATABASE_URL` in `.env` to a working MySQL connection string. Example:

```env
SECRET_KEY=replace_with_a_long_random_secret
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
DATABASE_URL=mysql+pymysql://root:your_mysql_password@localhost:3306/resume_api_db
GEMINI_API_KEY=
```

Do not commit `.env` or real API keys. The file is excluded by `.gitignore`.

Check the database connection:

```powershell
python test_db.py
```

Start the FastAPI backend:

```powershell
uvicorn app.main:app --reload --port 8000
```

The backend is available at `http://localhost:8000`.

## Frontend Setup

Open a second terminal and run:

```powershell
cd frontend
npm install
npm run dev
```

The frontend is available at `http://localhost:5173`. Its Vite configuration proxies `/api` requests to the backend at `http://localhost:8000`.

For a production frontend build:

```powershell
npm run build
npm run preview
```

## API Documentation

With the backend running, open:

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
- Health message: `http://localhost:8000/`

Important route groups include:

- `/users` for registration, login, and profile operations
- `/resume` for PDF and DOCX resume uploads
- `/internships` for browsing, matching, cover letters, skill gaps, and applications

## Optional Gemini Features

Set `GEMINI_API_KEY` in `.env` to enable Gemini-powered match summaries and cover-letter generation. Leave it empty if those features are not required or configure the application according to the behavior in `app/rag.py`.

## Testing

Run the database connectivity check with:

```powershell
python test_db.py
```

The frontend production build can be checked with:

```powershell
cd frontend
npm run build
```

## Notes

- The backend initializes database tables when the application starts.
- Resume files are stored in `uploads/` during runtime and are intentionally not committed.
- Internship source data and the precomputed matching index are stored in `data/`.
- Keep the backend and frontend running in separate terminals during local development.
