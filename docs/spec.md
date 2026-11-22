# PROJECT SPECIFICATION

## 1. Project Name

Multilingual Agritech & Resource Advisory Assistant

## 2. Project Overview

Build an AI-powered farming assistant that helps Indian farmers make better farming decisions using weather forecasts, soil information, mandi prices, and AI-generated agricultural advice.

Farmers should be able to ask questions through text or voice and receive simple answers in their preferred regional language.

The application should recommend suitable crops, suggest sowing and harvesting periods, provide irrigation guidance, display market prices, and help farmers understand crop diseases.

The application must be mobile-friendly, easy to use, and suitable for farmers with limited technical knowledge.

## 3. Main Objectives

- Help farmers choose suitable crops.
- Provide weather forecasts and weather-based farming advice.
- Display available mandi prices.
- Suggest suitable sowing and harvesting periods.
- Provide irrigation recommendations.
- Help farmers identify possible crop diseases.
- Support regional languages through text and voice.
- Help farmers find relevant government agricultural schemes.
- Provide practical advice using available and reliable data.

## 4. Technology Stack

Frontend:
- React.js
- Vite
- Tailwind CSS
- Axios
- React Router

Backend:
- Node.js
- Express.js
- REST APIs

Database:
- Standalone PostgreSQL
- Express-managed account authentication with bcrypt password hashes
- Server-validated HttpOnly session cookies and owner-scoped API authorization

AI:
- Groq API for agricultural questions and personalized advice.

Machine Learning:
- Python
- FastAPI
- Scikit-learn
- Gaussian Naive Bayes for optional crop recommendation.

External Services:
- A weather API for forecasts.
- Government agricultural market data through available AGMARKNET or e-NAM data sources.
- Speech-to-text for voice input.
- Text-to-speech for spoken answers.
- A maps API for nearby mandis and agricultural shops, if available.

Use environment variables for API keys and secrets.

Keep the architecture modular so each feature can be developed and tested separately.

Do not add unnecessary technologies or services before the core application works.

## 5. User Registration and Farmer Profile

Create a farmer registration and profile system.

Collect the following information:

- Farmer name.
- State and district.
- Village or location.
- Preferred language.
- Farm size.
- Soil type, if known.
- Available irrigation facilities.
- Current crops.
- Optional soil test information.

Save the profile in PostgreSQL, linked to the application's authenticated user ID.

Use the saved profile to personalize recommendations. Do not ask the farmer to enter the same information repeatedly.

Allow farmers to update their profiles.

## 6. Weather Assistant

Fetch weather information using a weather API.

Display:
- Current temperature.
- Humidity.
- Rainfall forecast.
- Wind speed.
- Weather conditions.
- Upcoming weather forecasts.

Provide farming advice based on the forecast.

Examples:
- Warn farmers about expected heavy rainfall.
- Suggest checking soil moisture before irrigation.
- Warn about weather conditions that increase crop disease risk.
- Suggest suitable periods for planned agricultural activities.

Requirements:
- Use real weather data from the API.
- Show the forecast date and update time.
- Handle unavailable data properly.
- Never invent weather forecasts.
- Clearly distinguish forecasts from AI-generated recommendations.

## 7. Mandi Market Intelligence

Create a mandi price information module.

Allow farmers to select:
- Crop or commodity.
- State.
- District.
- Nearby mandi, where available.

Display:
- Commodity name.
- Mandi name.
- Minimum price, if available.
- Maximum price, if available.
- Modal price, if available.
- Market date.
- Data source.

Use available government market data, such as AGMARKNET through api.data.gov.in, or another accessible official source.

If the data source provides historical records, show the correct market date.

Allow farmers to compare prices across available mandis.

If location and distance data are available, optionally help farmers compare market prices with travel distance.

Do not invent current prices or claim that a market price is live when it is outdated.

If market data is unavailable, display a clear message.

## 8. AI Crop Recommendation

Recommend suitable crops based on:
- Soil type.
- Soil nitrogen, phosphorus, and potassium values, if available.
- Soil pH, if available.
- Temperature.
- Humidity.
- Rainfall.
- Location.
- Season.
- Water availability.
- Previous crops, when relevant.

Provide the following for each recommendation:
- Crop name.
- Reasons for recommending it.
- Suitable planting period.
- Expected growing conditions.
- Water requirements.
- Basic fertilizer guidance.
- Important risks.

The recommendations must account for missing information.

Do not pretend to have soil measurements if the farmer has not provided them.

### Optional Machine Learning Model

Create a separate Python FastAPI service for crop prediction.

Use Gaussian Naive Bayes through Scikit-learn as the initial model.

Possible input features:
1. Nitrogen.
2. Phosphorus.
3. Potassium.
4. Temperature.
5. Humidity.
6. Soil pH.
7. Rainfall.

The model should return the predicted crop and relevant prediction information.

Use a suitable, documented agricultural dataset.

Split the dataset into training and test sets. Evaluate the trained model before deployment.

Do not claim a specific accuracy unless it has been verified using the actual implementation and test data.

If the machine learning service is unavailable, provide a controlled fallback using the AI assistant and available agricultural data.

Do not use arbitrary values for missing soil measurements.

## 9. Irrigation Planning

Create an irrigation advisory module.

Consider:
- Crop type.
- Crop growth stage.
- Weather forecast.
- Expected rainfall.
- Soil type.
- Water availability.
- Soil moisture, if available.

Provide:
- Suggested irrigation timing.
- Basic watering guidance.
- Weather-related warnings.
- Water conservation recommendations.

Clearly identify suggestions based on estimated information.

Do not present an estimated watering schedule as a precise measurement of soil moisture.

## 10. Crop Disease Assistant

Allow farmers to describe crop symptoms through text or voice.

Examples:
- Leaves turning yellow.
- Brown spots on leaves.
- Wilting plants.
- Visible insects.
- Unusual marks on fruits.

Optionally allow farmers to upload a crop photograph.

The AI should analyze the available information and return:
- Possible causes.
- Symptoms supporting the assessment.
- Recommended preventive measures.
- Basic crop-care guidance.
- When to seek expert assistance.

Clearly communicate uncertainty.

Do not claim a confirmed diagnosis from insufficient information.

Do not recommend dangerous pesticide mixtures or unsupported chemical dosages.

For serious problems, recommend contacting an agricultural expert or the local Krishi Vigyan Kendra.

## 11. Multilingual Text and Voice Assistant

Initially support:
- English.
- Hindi.
- Kannada.

Design the system so more Indian languages can be added later.

Provide:
- A text input box.
- A microphone button.
- Speech-to-text conversion.
- AI-generated responses.
- Text-to-speech output.
- A language selector.
- A button to repeat spoken answers.

The assistant should understand common farming questions, including regional-language expressions and code-mixed language where supported.

Example questions:

"Which crop is suitable for my soil?"

"Will it rain tomorrow?"

"What is the current tomato price near me?"

"ನಾಳೆ ಮಳೆ ಬರುತ್ತದೆಯೇ?"

"ನನ್ನ ಜಮೀನಿಗೆ ಯಾವ ಬೆಳೆ ಸೂಕ್ತವಾಗಿದೆ?"

"मेरी फसल के पत्ते पीले क्यों हो रहे हैं?"

Generate answers in the selected language.

Keep responses short and practical. Explain technical farming terms in simple language.

If a speech service fails, display an understandable error and allow text interaction to continue.

## 12. AI Multi-Agent Architecture

Use a simple modular architecture inspired by the AgriGuru research paper.

Do not build seven independent AI systems unnecessarily. Implement a root AI coordinator that routes requests to separate modules or functions.

### Agent 1: Root AI Coordinator

Responsibilities:
- Understand the farmer's question.
- Identify the type of request.
- Read relevant farmer profile information.
- Call the required module.
- Use external data when needed.
- Combine the results.
- Return a response in the preferred language.

### Agent 2: Soil Information Module

Responsibilities:
- Interpret available soil information.
- Explain NPK and pH values.
- Identify missing soil information.
- Provide basic soil-related recommendations.

### Agent 3: Crop Recommendation Module

Responsibilities:
- Analyze crop suitability.
- Use the machine learning service when available.
- Consider weather, soil, season, and water availability.
- Explain why a crop is recommended.

### Agent 4: Irrigation Planner

Responsibilities:
- Consider crop growth stage.
- Analyze available weather and rainfall information.
- Suggest suitable irrigation practices.
- Recommend water-saving measures.

### Agent 5: Crop Disease Module

Responsibilities:
- Analyze reported symptoms.
- Process uploaded crop images when image analysis is enabled.
- Suggest possible causes and preventive measures.
- Identify cases requiring expert assistance.

### Agent 6: Market Advisor

Responsibilities:
- Retrieve available mandi prices.
- Compare prices across available markets.
- Display market dates and data sources.
- Provide location-aware market information when available.

### Agent 7: Government Scheme and Seed Information Module

Responsibilities:
- Find relevant agricultural government schemes from verified information.
- Explain eligibility requirements when documented.
- Provide official application links when available.
- Provide information about suitable seed varieties when supported by reliable sources.
- Show nearby agricultural shops when a maps service is configured.

If verified information is unavailable, state this clearly.

For the first version, implement the Root Coordinator, Crop Recommendation, Irrigation Planner, Disease Module, Market Advisor, and Soil Information Module.

The Government Scheme and Seed Information Module can be added after the core application works.

## 13. System Architecture Diagram

Use the following simplified architecture when building the application.

                         FARMER
                            |
                            v
               +-------------------------+
               | React Web Application  |
               |                         |
               | Farmer Profile          |
               | Dashboard               |
               | Text and Voice Input    |
               | Crop Image Upload       |
               +------------+------------+
                            |
                            v
               +-------------------------+
               | Node.js + Express API   |
               |                         |
               | Session Cookie Checks   |
               | Request Validation      |
               | API Integration         |
               | Response Handling       |
               +------------+------------+
                            |
                            v
               +-------------------------+
               | Root AI Coordinator     |
               | Groq API              |
               +------------+------------+
                            |
             +--------------+--------------+
             |              |              |
             v              v              v
       +-----------+  +-----------+  +-----------+
       | Soil and  |  | Crop      |  | Irrigation|
       | Soil Data |  | Advisor   |  | Planner   |
       +-----------+  +-----------+  +-----------+
             |              |              |
             +--------------+--------------+
                            |
             +--------------+--------------+
             |              |              |
             v              v              v
       +-----------+  +-----------+  +-----------+
       | Disease   |  | Market    |  | Government|
       | Assistant |  | Advisor   |  | Schemes   |
       +-----------+  +-----------+  +-----------+
             |              |              |
             +--------------+--------------+
                            |
                            v
               +-------------------------+
               | External Data Services  |
               |                         |
               | Weather API             |
               | Official Mandi Data     |
               | Speech Services         |
               | Maps API                |
               | Crop ML Service         |
               +-------------------------+

                            |
                            v
               +-------------------------+
               | Standalone PostgreSQL   |
               |                         |
               | Farmer Profiles         |
               | Preferences             |
               | Farming History         |
               | Saved Recommendations   |
               +-------------------------+

The diagram describes the logical system design. Implement the connections in the actual application.

The React app uses the Express authentication endpoints for sign-up, sign-in, and sign-out. The API validates an opaque HttpOnly session cookie, derives the farmer identity from the session, and performs parameterized PostgreSQL queries on the server.

Keep database credentials, password hashes, session tokens, and AI API keys on the server. Never connect to PostgreSQL from the browser or trust a user ID supplied by the frontend.

## 14. Main Application Pages

### Home Page
- Project introduction.
- Language selector.
- Login and registration.
- Main farming features.

### Farmer Profile
- Farmer information.
- Location.
- Farm size.
- Soil information.
- Current crops.
- Preferred language.

### Dashboard
Display:
- Weather forecast.
- Available mandi prices.
- Recommended crops.
- Irrigation reminders.
- Weather alerts.
- Quick-access AI assistant.

### AI Farming Assistant
- Text questions.
- Voice input.
- Spoken responses.
- Farming conversation history.

### Crop Recommendations
- Recommended crops.
- Reasons for recommendations.
- Planting guidance.
- Water requirements.
- Main risks.

### Mandi Prices
- Crop selection.
- Location selection.
- Available mandi prices.
- Market dates.
- Price comparison.

### Crop Disease Assistant
- Symptom description.
- Optional image upload.
- Possible causes.
- Preventive advice.

### Irrigation Planner
- Crop information.
- Weather-based suggestions.
- Water conservation tips.

### Government Schemes
- Scheme information.
- Eligibility details when verified.
- Official links.

### Settings
- Language selection.
- Profile updates.
- Voice preferences.

## 15. Backend API Endpoints

Implement these endpoints with appropriate validation and error handling.

Farmer:
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/session
- GET /api/auth/verify
- POST /api/auth/verification/resend
- GET /api/farmers/profile
- GET /api/farmers/profile/:id
- PUT /api/farmers/profile/:id

Weather:
- GET /api/weather

Mandi:
- GET /api/mandi/prices
- GET /api/mandi/compare

AI:
- POST /api/ai/ask
- POST /api/ai/crop-recommendations
- POST /api/ai/irrigation
- POST /api/ai/crop-protection

Voice:
- POST /api/voice/transcribe
- POST /api/voice/speak

Images:
- POST /api/disease/analyze

Government Schemes:
- GET /api/schemes
- POST /api/schemes/recommendations

Create the Python crop prediction service separately if machine learning is implemented.

Protect private profile information with authentication and authorization. Validate uploaded files and limit file sizes.

## 16. Database Models

Create standalone PostgreSQL tables for:

### User Account
- ID.
- Email.
- Bcrypt password hash.
- Email verification time.
- Created and updated timestamps.

### Farmer
- ID linked to `app_users.id`.
- Name.
- Email from the authenticated application account.
- State.
- District.
- Village or location.
- Preferred language.
- Farm size.
- Soil information.
- Irrigation facilities.
- Current crops.
- Created date.

### Authentication Session
- User ID linked to `app_users.id`.
- SHA-256 hash of a random session token.
- Expiration and creation timestamps.

### Email Verification
- User ID linked to `app_users.id`.
- SHA-256 hash of a random one-time verification token.
- Expiration and creation timestamps.

### Farming History
- Farmer ID linked to the authenticated application user.
- Crop.
- Planting date, if supplied.
- Harvest date, if supplied.
- Notes.

### Saved Recommendation
- Farmer ID linked to the authenticated application user.
- Recommendation type.
- Recommendation details.
- Related crop, if applicable.
- Creation date.
- Relevant data sources.

Store only bcrypt password hashes; never store plaintext passwords. Authenticate every private API request on the server and restrict queries to the ID derived from its valid session.

Do not collect unnecessary personal information.

## 17. User Interface Requirements

Create a clean, modern, responsive interface.

Use:
- A simple dashboard.
- Green and earth-inspired design elements.
- Readable fonts.
- Large buttons.
- Clear icons.
- Weather cards.
- Market price cards.
- Crop recommendation cards.
- Easy-to-find microphone buttons.
- Loading indicators.
- Clear error messages.

Prioritize mobile screens.

Keep the interface understandable for farmers with limited digital experience.

Avoid overcrowding the dashboard.

Every visible feature should work. Do not leave buttons that only look functional.

## 18. Accuracy and Safety Requirements

- Use real external data for current weather and market prices.
- Display the source and update time for important data.
- Never fabricate missing API results.
- Clearly label AI-generated advice.
- Distinguish observed data from estimates.
- Explain uncertainty in crop disease assessments.
- Do not provide unsupported pesticide dosages.
- Use verified government information for scheme recommendations.
- Handle API failures without crashing the application.
- Do not use fabricated soil measurements.
- Provide a fallback when optional AI or machine learning services are unavailable.
- Protect farmer information and API credentials.

## 19. Environment Variables

Create a .env.example file.

Include only the required variable names, such as:

DATABASE_URL=
DATABASE_SSL=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=
API_PUBLIC_URL=
GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-20b
GROQ_VISION_MODEL=qwen/qwen3.8-27b
WEATHER_API_KEY=
AGMARKNET_API_KEY=
PORT=
CLIENT_ORIGIN=
VITE_API_URL=

Use only the variables required by the selected services.

Do not commit real API keys or passwords to GitHub.

If a data source does not require an API key, configure it accordingly.

## 20. Development and Deployment

Build the project in stages.

Stage 1: Core Application
- React frontend.
- Node.js backend.
- Standalone PostgreSQL connection and backend-managed authentication.
- Farmer profile.
- Responsive dashboard.
- Language selection.

Stage 2: Live Data
- Weather API.
- Official mandi data integration.
- Data source and update-time display.
- API error handling.

Stage 3: AI Assistant
- Groq integration.
- Farmer-profile-aware conversations.
- Crop recommendations.
- Multilingual responses.

Stage 4: Voice Support
- Speech-to-text.
- Text-to-speech.
- Microphone interaction.
- Spoken responses.

Stage 5: Agricultural Intelligence
- Irrigation planner.
- Soil information module.
- Crop disease assistant.
- Optional crop image analysis.

Stage 6: Advanced Features
- Crop recommendation machine learning service.
- Government scheme advisor.
- Nearby mandi comparison.
- Seed variety information.

Do not begin with every advanced feature at once. Complete and test each stage before moving to the next.

Deployment:
- Frontend on Render or Vercel.
- Backend on Render.
- Standalone PostgreSQL and backend-managed authentication.
- Optional crop prediction service deployed separately.

Configure environment variables, CORS, production API URLs, and error handling before deployment.

## 21. Expected Final Output

Build a complete, working full-stack application, not a static UI.

The completed core application must include:
- Farmer profile management.
- Responsive dashboard.
- Weather forecasts.
- Available mandi prices.
- AI farming assistant.
- Crop recommendations.
- English, Hindi, and Kannada support.
- Text and voice interaction.
- PostgreSQL integration and secure server-side session authentication.
- Proper error handling.
- Deployment instructions.

Advanced features should be added in stages.

Provide a README containing installation steps, environment variable setup, API configuration, project structure, local development instructions, and deployment steps.

Include sample farmer data only for development and testing. Clearly distinguish sample information from live data.

Before finishing, test the frontend, backend, database connection, and available API integrations.

Fix errors before marking a feature as complete.

## 22. Instructions for Codex

First, inspect the current project directory and existing files.

If the project already contains code, understand it and preserve working features.

If the directory is empty, create the project structure from scratch.

Implement the application step by step using the specified technology stack.

Do not generate the entire application as disconnected sample code.

Connect the frontend, backend, database, AI service, and external data sources properly.

Use the architecture diagram as the design reference.

Start with Stage 1 and continue through the core features. Add advanced features only after the core application works.

If API credentials are missing, implement the integration structure and explain which credentials are required. Do not pretend an integration works without testing it.

Run the available tests and fix errors.

The final result should be a functional, deployable agricultural advisory web application suitable for an initial demonstration to farmers.
