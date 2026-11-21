# 📮 Postman API Management Guide — Farmer Saathi

This guide explains how to import and manage all **Farmer Saathi APIs** using **Postman**.

---

## 📁 Included Postman Files

In the project root, you have two ready-to-use files:

1. **`Farmer_Saathi_Postman_Collection.json`** — Contains all endpoints organized into 10 categories, complete with pre-configured headers, query parameters, sample JSON bodies, and automatic JWT auth test scripts.
2. **`Farmer_Saathi_Postman_Environment.json`** — Environment configuration containing `baseUrl` (`http://localhost:4000`) and the `jwt_token` variable.

---

## 🚀 Step 1: Import into Postman

1. Open **Postman** (Desktop app or [web.postman.co](https://web.postman.co)).
2. In the top-left corner, click **Import** (or press `Ctrl + O` / `Cmd + O`).
3. Drag and drop (or browse to):
   - `Farmer_Saathi_Postman_Collection.json`
   - `Farmer_Saathi_Postman_Environment.json`
4. Click **Import**.

---

## ⚙️ Step 2: Select the Environment

1. In the top-right corner of Postman, locate the Environment dropdown (defaults to *No Environment*).
2. Select **Farmer Saathi (Local Dev)**.
3. Verify that `baseUrl` is set to `http://localhost:4000`.

---

## 🔐 Step 3: Automatic Authentication

The collection is pre-configured with automatic token management:

1. Navigate to **2. Authentication > Register Farmer** (or **Login Farmer**).
2. Click **Send**.
3. On a successful response, Postman's embedded script automatically extracts the JWT token from the response body and saves it to the `jwt_token` environment variable:
   ```javascript
   pm.environment.set('jwt_token', res.token);
   ```
4. **All protected endpoints** (Profile, Planner, Farm History, Voice, Notifications) inherit `Bearer {{jwt_token}}` automatically at the collection root — no manual copying/pasting of tokens required!

---

## 📑 Collection Overview

| Folder | Endpoints Included | Description |
|---|---|---|
| **1. System & Health** | `GET /api/health` | Verifies PostgreSQL, Redis, and Firebase FCM connectivity |
| **2. Authentication** | `POST /api/auth/register`<br>`POST /api/auth/login`<br>`POST /api/auth/social-login`<br>`GET /api/auth/session`<br>`POST /api/auth/forgot-password`<br>`POST /api/auth/logout` | Full user signup, bcrypt login, and JWT bearer token issuance |
| **3. Push Notifications & FCM** | `GET /api/notifications/health`<br>`POST /api/notifications/test-dispatch`<br>`POST /api/notifications/trigger-holiday`<br>`POST /api/notifications/trigger-feature`<br>`GET /api/notifications`<br>`POST /api/notifications/fcm-token` | Live Google Firebase push notification dispatches & holiday alerts |
| **4. Farmer Profile** | `GET /api/farmers/me`<br>`PUT /api/farmers/me/preferred-language` | Profile inspection and language preference updates (13+ languages) |
| **5. AI Advisory** | `POST /api/ai/chat` | Multilingual AI advisory powered by Groq and Llama |
| **6. Mandi & Market** | `GET /api/mandi`<br>`GET /api/mandi/trends` | Live Agmarknet crop prices, market trends, and historical analytics |
| **7. Weather** | `GET /api/weather` | 7-day farm weather forecasts with rainfall and moisture insights |
| **8. Schemes** | `GET /api/schemes`<br>`GET /api/schemes/:id` | Central & State agricultural government welfare schemes |
| **9. Farm Planner** | `GET /api/farmers/history`<br>`POST /api/farmers/history`<br>`GET /api/planner` | Crop rotation records, sowing history, and predictive farm planning |
| **10. Voice & Audio** | `POST /api/voice/speak` | Sarvam AI Text-to-Speech audio generation |

---

## 🧪 Testing Notifications in Postman

To test live Firebase Push Notifications via Postman:
1. Ensure your server is running (`npm run dev`).
2. Open **3. Push Notifications & FCM > Send Test Push Notification**.
3. Click **Send**.
4. You will receive a `200 OK` response with:
   ```json
   {
     "success": true,
     "message": "Test notification dispatched successfully via FCM.",
     "health": {
       "configured": true,
       "mode": "firebase-admin",
       "projectId": "farmer-saathi-b8a8a"
     },
     "details": {
       "fcm": {
         "topicDispatch": {
           "success": true,
           "messageId": "projects/farmer-saathi-b8a8a/messages/..."
         }
       }
     }
   }
   ```
