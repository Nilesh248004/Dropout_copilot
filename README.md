# Dropout Copilot

Responsive UI: the project can be explored in both desktop and mobile views.

## Deployment Environment Variables
Do not commit `.env` files. For Render (backend / MCP server) and Vercel (frontend),
set environment variables in the hosting dashboard. Use your local `.env` files
as the reference for values.

### Frontend (Vercel)
Required:
- `REACT_APP_API_BASE_URL`
- `REACT_APP_ML_API_URL`
- `REACT_APP_GOOGLE_CLIENT_ID`
- `REACT_APP_PRIMARY_ORIGINS`
- `REACT_APP_EMAILJS_SERVICE_ID`
- `REACT_APP_EMAILJS_TEMPLATE_ID`
- `REACT_APP_EMAILJS_PUBLIC_KEY`

### Backend (Render)
Required:
- `DATABASE_URL` (or `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_NAME`)
- `DB_SSL`
- `PORT`
- `ML_API_URL`
- `CORS_ORIGIN`

Optional (features):
- `MCP_ENABLED`, `MCP_SERVER_URL`, `MCP_URL`, `MCP_API_KEY`
- `EMAIL_PROVIDER`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_SECURE`
- `SMS_PROVIDER`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
- `B2_ENABLED`, `B2_BUCKET_NAME`, `B2_KEY_ID`, `B2_APPLICATION_KEY`, `B2_S3_ENDPOINT`, `B2_REGION`, `B2_SIGNED_URL_TTL`
- `BULK_IMPORT_LIMIT`

### MCP Server (Render or separate host)
Required:
- `MCP_PORT`
- `MCP_PATH`
- `DATABASE_URL` (or `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_NAME`)

Optional (LLM providers):
- `LLM_PROVIDER`
- `OPENAI_API_KEY`, `OPENAI_MODEL`
- `GROQ_API_KEY`, `GROQ_MODEL`, `GROQ_BASE_URL`
- `OLLAMA_BASE_URL`, `OLLAMA_MODEL`
- `MCP_SERVER_URL`, `MCP_SERVER_LABEL`

