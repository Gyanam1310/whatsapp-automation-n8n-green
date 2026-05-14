# Gaurakshan WhatsApp Automation System

Automated WhatsApp donation announcement system for Gaurakshan (cow shelter) trusts. Volunteers fill a web form, a formatted message is generated, queued in Google Sheets, and sent to a WhatsApp group via GreenAPI — with n8n orchestrating the automation workflow.

---

## Features

- **Automated WhatsApp messaging** — sends formatted donation announcements to a WhatsApp group via GreenAPI
- **Google Sheets queue** — every submission is logged with status tracking (PENDING → SENT)
- **Google Drive image integration** — family folders and images browsed directly from Drive
- **Live WhatsApp-style preview** — editable markdown preview with real-time rendered bubble
- **n8n automation workflow** — polls pending submissions and triggers message delivery
- **Dockerized architecture** — single `docker compose up -d` to run everything
- **Retry-ready pipeline** — status tracking supports future retry logic

---

## Architecture

```
Browser (Form)
    │
    ▼
Frontend (nginx :80)
    │  POST /submit
    ▼
Backend (Express :5000)
    │  appendSubmissionToSheet()
    ▼
Google Sheets (queue)
    │
    ▼
n8n (:5678)  ←── polls GET /api/automation/pending-today
    │              POST /api/automation/mark-sent
    │
    ▼
GreenAPI  ──►  WhatsApp Group
```

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | HTML / CSS / Vanilla JS |
| Backend | Node.js + Express |
| Queue | Google Sheets API |
| Storage | Google Drive API |
| Messaging | GreenAPI (WhatsApp) |
| Automation | n8n |
| Reverse proxy | nginx |
| Runtime | Docker + Docker Compose |

---

## Quick Start

### Prerequisites

- Docker Desktop installed and running
- A Google Cloud service account with Sheets + Drive API access
- A GreenAPI account with an active WhatsApp instance

### 1. Clone the repository

```bash
git clone https://github.com/your-username/gaurakshan-automation.git
cd gaurakshan-automation
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your real values (see comments inside the file).

### 3. Add Google service account

Place your downloaded service account JSON at:

```
backend/service-account.json
```

This file is excluded from git by `.gitignore`.

### 4. Start everything

```bash
docker compose up -d --build
```

### 5. Open the app

| Service | URL |
|---|---|
| Frontend | http://localhost |
| Backend health | http://localhost:5000/health |
| n8n | http://localhost:5678 |
| n8n (via nginx) | http://localhost/n8n |

---

## Environment Variables

Copy `.env.example` to `.env`. Key variables:

| Variable | Description |
|---|---|
| `GOOGLE_SHEETS_SPREADSHEET_ID` | ID from your Google Sheets URL |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` | Root Drive folder containing family subfolders |
| `GREENAPI_INSTANCE_ID` | GreenAPI instance ID |
| `GREENAPI_API_TOKEN` | GreenAPI API token |
| `WHATSAPP_GROUP_ID` | Target WhatsApp group ID |
| `N8N_WEBHOOK_URL` | n8n webhook trigger URL (internal Docker network) |

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Backend health check |
| GET | `/drive/folders` | List family folders from Google Drive |
| GET | `/drive/files/:folderId` | List images in a folder |
| GET | `/drive/image/:fileId` | Stream an image from Drive |
| POST | `/submit` | Submit a donation announcement |
| GET | `/api/automation/pending-today` | Get today's pending submissions |
| POST | `/api/automation/mark-sent` | Mark a submission as sent |

---

## n8n Workflow

Import `n8n-whatsapp-daily-workflow.json` into your n8n instance.

The workflow:
1. Polls `GET http://backend:5000/api/automation/pending-today`
2. For each pending row, sends the image + message via GreenAPI
3. Calls `POST http://backend:5000/api/automation/mark-sent` on success

---

## Google Sheets Schema

| Column | Field | Description |
|---|---|---|
| A | id | Unique submission ID |
| B | createdAt | Submission timestamp |
| C | donationDate | Scheduled date |
| D | familyName | Donor family name |
| E | imageUrl | Google Drive public image URL |
| F | formattedMessage | WhatsApp markdown message |
| G | status | PENDING / SENT / ERROR |
| H | retryCount | Number of send attempts |
| I | sentAt | Timestamp when sent |
| J | errorMessage | Last error if any |

---

## Screenshots

_Add screenshots here_

---

## Security

- All credentials are excluded from the repository via `.gitignore`
- Copy `.env.example` → `.env` and fill in your own values
- `backend/service-account.json` must be placed manually — never committed
- The `.env` file at the root is the single source of truth for Docker

---

## Future Improvements

- [ ] Retry queue for failed sends
- [ ] Admin dashboard for submission history
- [ ] Authentication for the web form
- [ ] Scheduled daily automation via cron
- [ ] Multi-group WhatsApp support
- [ ] SMS fallback

---

## License

MIT
