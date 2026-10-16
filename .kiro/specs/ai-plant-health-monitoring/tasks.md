# Implementation Plan: AI-Powered Plant Health Monitoring IoT System

## Overview

This implementation plan breaks down the development of a full-stack Next.js 16+ TypeScript application that receives telemetry data and images from ESP32-S3-CAM IoT devices, analyzes plant health using Google Gemini AI, stores data in MongoDB, and provides real-time monitoring through an interactive dashboard. The tasks are organized to build incrementally from project setup through complete feature implementation.

## Tasks

- [x] 1. Initialize Next.js project and configure development environment
  - Create Next.js 16+ project with TypeScript using `npx create-next-app@latest`
  - Configure TypeScript with strict mode in `tsconfig.json`
  - Set up `.env.local` file with placeholder environment variables for MongoDB, Cloudinary, and Gemini AI
  - Install required dependencies: `mongoose`, `cloudinary`, `@google/genai`, `recharts`, `lucide-react`
  - Configure Tailwind CSS (should be included in Next.js setup)
  - Define design-system color tokens in `app/globals.css` via Tailwind `@theme` (sidebar #0C0E0D, accent #CDF463, deep green #17352C, canvas #F4F6F5, chart greens #14532D/#16A34A/#84CC16) and load the Inter typeface via `next/font`
  - Create project directory structure: `app/api/telemetry/`, `lib/`, `models/`, `types/`
  - _Requirements: 11.1, 11.2, 11.3, 10.1, 10.2, 10.6, 10.7, 10.11_

- [x] 2. Implement database layer with MongoDB and Mongoose
  - [x] 2.1 Create MongoDB connection helper with connection pooling
    - Implement `lib/mongodb.ts` with connection caching logic for development hot-reload
    - Add connection string validation and error handling for missing `MONGODB_URI` environment variable
    - Export `connectToDatabase` function that returns cached connection or creates new one
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 11.1, 11.4_

  - [x] 2.2 Define Mongoose schema and model for telemetry data
    - Create `models/Telemetry.ts` with `ITelemetry` interface extending Mongoose `Document`
    - Define schema with fields: `timestamp` (Date, indexed), `temperature` (Number), `humidity` (Number, 0-100), `soilMoisture` (Number, 0-100), `imageUrl` (String), `healthScore` (Number, 0-100, optional), `status` (enum: Healthy/Warning/Critical, optional), `diagnosis` (String, optional), `recommendedActions` (Array of Strings, optional)
    - Add schema validation constraints (min/max for humidity and soilMoisture)
    - Implement model singleton pattern to prevent recompilation in development
    - _Requirements: 3.1, 3.4, 4.3, 4.4, 4.5, 4.6_

- [x] 3. Create TypeScript type definitions
  - Create `types/telemetry.ts` with interfaces: `TelemetryInput`, `HealthAssessment`, `TelemetryRecord`, `TelemetryResponse`, `ErrorResponse`
  - Define precise types matching the Mongoose schema and API contracts
  - Export all interfaces for use across the application
  - _Requirements: 10.5, 1.1, 4.3, 4.4, 4.5_

- [x] 4. Implement POST /api/telemetry endpoint
  - [x] 4.1 Set up API route file and configure external services
    - Create `app/api/telemetry/route.ts` with Next.js 16 App Router conventions
    - Configure Cloudinary SDK with environment variables (cloud_name, api_key, api_secret)
    - Initialize Google GenAI client (`GoogleGenAI` from `@google/genai`) with `GEMINI_API_KEY` environment variable
    - Add environment variable validation with descriptive error messages
    - _Requirements: 1.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 4.2 Implement multipart form data parsing and validation
    - Parse incoming request using `request.formData()` to extract image file and telemetry fields
    - Validate image field: check for presence and non-zero size
    - Extract temperature, humidity, soilMoisture fields from form data
    - Implement validation logic: temperature is numeric, humidity is 0-100, soilMoisture is 0-100
    - Return HTTP 400 with descriptive error messages for validation failures
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 4.3 Implement Cloudinary image upload
    - Convert File object to Buffer using `arrayBuffer()` and `Buffer.from()`
    - Upload image to Cloudinary using `cloudinary.uploader.upload_stream()`
    - Configure upload to use folder `plant-monitoring` and resource_type `image`
    - Extract and store secure_url from Cloudinary response
    - Handle upload failures with HTTP 500 error response
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 4.4 Implement Google Gemini AI health analysis
    - Construct AI prompt with environmental telemetry context (temperature, humidity, soil moisture)
    - Include system instructions: "You are an expert botanist and agricultural AI assistant..."
    - Create image part with base64 encoding and MIME type from uploaded file
    - Call Gemini AI model `gemini-2.5-flash` with prompt and image
    - Parse JSON response from AI text output using regex to extract JSON block
    - Validate AI response structure: health_score (0-100), status (Healthy/Warning/Critical), diagnosis, recommended_actions
    - Implement error handling: log AI failures but continue without health assessment (graceful degradation)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.7, 4.8_

  - [x] 4.5 Persist telemetry data to MongoDB
    - Connect to database using `connectToDatabase()` helper
    - Create new Telemetry document with timestamp (server time), telemetry fields, image URL, and health assessment (if available)
    - Save document to MongoDB using `telemetryDoc.save()`
    - Handle database failures with HTTP 500 error response and descriptive logging
    - Return HTTP 200 success response with document ID
    - _Requirements: 3.1, 3.2, 3.3, 4.6, 1.7_

- [x] 5. Checkpoint - Test telemetry ingestion endpoint
  - Ensure database connection works and environment variables are configured
  - Test POST /api/telemetry with sample multipart form data
  - Verify validation errors return appropriate HTTP 400 responses
  - Verify successful uploads return HTTP 200 and data persists in MongoDB
  - Ask the user if questions arise.

- [x] 6. Implement GET /api/telemetry/history endpoint
  - [x] 6.1 Create history API route with query parameter handling
    - Create `app/api/telemetry/history/route.ts` with Next.js GET handler
    - Parse `limit` query parameter from URL search params
    - Implement default limit of 100 records when parameter not provided
    - Validate limit parameter: must be numeric and greater than 0
    - Return HTTP 400 error for invalid limit parameter
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.8_

  - [x] 6.2 Query and return telemetry records
    - Connect to database using `connectToDatabase()` helper
    - Query Telemetry collection using `Telemetry.find()` with sort by timestamp descending
    - Apply limit to query using `.limit()`
    - Use `.lean()` for optimized plain JavaScript objects
    - Return records as JSON array with all fields (telemetry, timestamps, image URLs, health assessments)
    - Handle database query failures with HTTP 500 error response
    - _Requirements: 5.5, 5.6, 5.7_

- [x] 7. Implement dashboard page with real-time monitoring
  - [x] 7.1 Create main dashboard component structure
    - Create `app/page.tsx` as client component with `'use client'` directive
    - Define `TelemetryRecord` interface for data fetching (should match API response type)
    - Set up React state for `currentData`, `historicalData`, `loading`, and `error`
    - Implement responsive layout with Tailwind CSS: container, grid system for desktop/mobile
    - Build the application shell: near-black sidebar (brand mark, nav items with Lucide icons, lime-green active state, user block at bottom) beside a light `canvas` content area, per the s.host-style reference design
    - Apply Material Design 3 conventions from the design doc: 8px spacing grid, white cards with 12-16px radii and subtle elevation, tabbed content header
    - _Requirements: 6.10, 10.1, 10.4, 10.5, 10.6, 10.7, 10.8_

  - [x] 7.2 Implement data fetching logic
    - Create `fetchCurrentData` function that calls `/api/telemetry/history?limit=1`
    - Create `fetchHistoricalData` function that calls `/api/telemetry/history?limit=50`
    - Handle fetch errors with try-catch and update error state
    - Parse JSON responses and update React state
    - _Requirements: 6.9, 7.4, 5.1, 5.2_

  - [x] 7.3 Implement auto-refresh mechanism
    - Use `useEffect` hook to fetch data on component mount
    - Set up `setInterval` to call fetch functions every 30 seconds (30000ms)
    - Clean up interval on component unmount with return cleanup function
    - Ensure state updates trigger UI re-renders without full page reload
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 7.4 Build current status display section
    - Display most recent plant image using `imageUrl` from `currentData` with responsive sizing
    - Render health score as a radial gauge (Recharts `RadialBarChart`) with the numeral displayed prominently (e.g., "85/100"); the ring is status-colored by score (≥70 green, 40–69 yellow, <40 red)
    - Display status badge as a soft-tinted pill with color coding: green (Healthy), yellow (Warning), red (Critical)
    - Create `getStatusColor` helper function for status-to-Tailwind-class mapping
    - Show diagnosis text in readable paragraph format
    - Display recommended actions as bulleted list
    - Handle cases where health assessment data is not available (graceful degradation)
    - _Requirements: 6.1, 6.5, 6.6, 6.7, 6.8, 10.3, 10.10_

  - [x] 7.5 Build environmental metrics display section
    - Import Lucide React icons: `Thermometer`, `Wind`, `Droplets`, `Activity`
    - Display temperature with icon and units (°C)
    - Display humidity with icon and units (%)
    - Display soil moisture with icon and units (%)
    - Display last update timestamp formatted with `toLocaleString()`
    - Use icon-text layout with appropriate spacing
    - Style each metric as a stat tile per the design system: icon + small gray label + large bold numeral with units
    - _Requirements: 6.2, 6.3, 6.4, 10.2, 10.11_

  - [x] 7.6 Implement historical trend charts
    - Import Recharts components: `LineChart`, `Line`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `Legend`, `ResponsiveContainer`
    - Create temperature over time chart with dark green line (#14532D), X-axis (time), Y-axis (°C)
    - Create humidity over time chart with green line (#16A34A), X-axis (time), Y-axis (%)
    - Create soil moisture over time chart with lime line (#84CC16), X-axis (time), Y-axis (%)
    - Add soft vertical gradient area fills under each line (Recharts `<defs><linearGradient>` fading to transparent)
    - Implement `formatTimestamp` helper to format timestamps for chart X-axis display
    - Reverse historical data array for chronological order in charts (API returns newest first)
    - Configure responsive container for mobile and desktop viewports
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 10.9_

  - [x] 7.7 Add loading and error states
    - Display loading spinner or message while initial data is being fetched
    - Display error message UI when fetch operations fail
    - Ensure loading state prevents rendering incomplete dashboard
    - _Requirements: 6.9, 7.4_

- [x] 8. Checkpoint - Test complete dashboard functionality
  - Verify dashboard loads and displays current data correctly
  - Test auto-refresh by waiting 30 seconds and observing data updates
  - Verify all charts render with historical data
  - Test responsive design on mobile and desktop viewports
  - Ensure status color coding works for all status values
  - Ask the user if questions arise.

- [x] 9. Configure environment variables and validate setup
  - Create `.env.local` file with all required environment variables
  - Add MongoDB connection string with proper authentication
  - Add Cloudinary credentials (cloud_name, api_key, api_secret)
  - Add Google Gemini API key
  - Test that missing environment variables produce descriptive error messages
  - Verify all external service integrations work end-to-end
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [ ]* 10. Write integration tests for API endpoints
  - Set up testing framework (Jest or Vitest) with Next.js testing utilities
  - Write tests for POST /api/telemetry: valid input, missing fields, invalid types, image upload, AI analysis
  - Write tests for GET /api/telemetry/history: default limit, custom limit, invalid limit, empty database
  - Mock external services (Cloudinary, Gemini AI) for isolated testing
  - Test error handling paths: database failures, upload failures, AI failures
  - _Requirements: All requirements_

- [ ]* 11. Write unit tests for dashboard components
  - Test data fetching functions with mocked fetch responses
  - Test `getStatusColor` helper function with all status values
  - Test `formatTimestamp` helper function with various timestamp formats
  - Test error and loading state rendering
  - Test chart data transformation (reverse array for chronological order)
  - _Requirements: 6.1-6.10, 7.1-7.7, 8.1-8.4_

- [x] 12. Final validation and documentation
  - Test complete end-to-end flow: IoT device simulation → API ingestion → dashboard display
  - Verify auto-refresh updates dashboard every 30 seconds
  - Test graceful degradation when AI analysis fails
  - Verify all validation rules work correctly
  - Create README.md with setup instructions, environment variables, and usage guide
  - Document API endpoints with request/response examples
  - Ask the user if questions arise.

- [x] 13. Specialize AI prompting and add context caching
  - Extract all Gemini interaction into `lib/gemini.ts` exposing `analyzePlantHealth()`
  - Write a maize-and-beans-specific system prompt (fixed-scene description, crop disease/deficiency indicators, pests, telemetry cross-checks, environment ranges, scoring rubric, strict-JSON contract) sized ≥1,024 tokens for cacheability
  - Send the static prompt as a Gemini system instruction; per-request contents carry only the telemetry line and image
  - Create a Gemini explicit context cache (1h TTL) and reference it via `cachedContent`; fall back to inline system instruction when caching is unavailable (free-tier quota) or expired
  - Detect real image MIME type from magic bytes when the declared type is not image/*
  - Add development-only inline (data URI) image storage fallback when Cloudinary is unconfigured (4MB cap); render data URIs on the dashboard with `unoptimized`
  - _Requirements: 2.5, 4.2, 4.9, 4.10, 4.11_

- [x] 14. Build device simulator SPA
  - Create `app/simulator/page.tsx` client page using the application shell and design system
  - Range sliders for temperature/humidity/soil moisture with a Randomize values control
  - Image picker with preview plus a bundled sample image (`public/sample-plant.webp`) selectable in one click
  - Submit multipart form-data to POST /api/telemetry (identical to the device contract)
  - On success, fetch the latest record and render the stored verdict (HealthGauge, StatusBadge, diagnosis, actions) with a dashboard link; surface endpoint errors verbatim
  - Add Simulator to the sidebar navigation with pathname-based active states
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_

- [x] 15. Build reports and analytics page
  - Create `app/reports/page.tsx` with selectable analysis window (default from Settings), stat cards (avg/min/max per metric, avg health score), status distribution bars, health-score and combined environmental charts, recent-records table, and CSV export
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8_

- [x] 16. Add health alert notifications bell and shared page header
  - Create `app/components/NotificationsBell.tsx` (60s polling, Warning/Critical alerts, green unread dot, read-state in localStorage) and `app/components/PageHeader.tsx`; refactor all pages to use the shared header
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7_

- [x] 17. Build settings page with persisted preferences
  - Create `lib/settings.ts` (localStorage persistence + change events) and `app/settings/page.tsx` (refresh interval, alert preferences, default reports window, device endpoint with copy); wire the dashboard interval and bell filters to settings
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 8.1_

- [x] 18. Build help and usage guide page
  - Create `app/help/page.tsx` static guide (system flow, per-page usage, color language, device contract); make all sidebar items functional links with active states
  - _Requirements: 16.1, 16.2, 16.3, 16.4_

- [x] 19. Build site-wide custom Select dropdown
  - Create `app/components/Select.tsx` (generic controlled component: styled trigger, popover listbox, deep-green selected state with check, Escape/outside-click close, disabled support)
  - Replace native selects on the Reports and Settings pages
  - _Requirements: 10.12_

- [x] 20. Add Critical email alerts via Resend
  - Create `models/AlertSettings.ts` (server-side singleton: email, enabled, lastEmailAt) and `app/api/settings/alerts/route.ts` (GET/PUT with validation)
  - Create `lib/alerts.ts`: Resend-based sender with branded HTML/text email (score, diagnosis, actions, telemetry), 1-hour cooldown, dev log fallback without `RESEND_API_KEY`, never blocks ingestion
  - Trigger from the telemetry route when an assessment is Critical; add Email Alerts card (register email + toggle) to Settings; rename Device card to "Connect device"
  - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7_

- [x] 21. Split Reports into Insights and Records tabs
  - Add interactive tab support to `PageHeader`; move the records table to a Records tab showing the full window; label the soil column "Soil Moisture"
  - _Requirements: 13.7_

- [x] 22. Add helper info icons to charts and data cards
  - Create `app/components/InfoHint.tsx` tooltip component; attach explanations to the Reports cards and the dashboard trend charts (via a TrendChart `hint` prop)
  - _Requirements: 10.13_

- [x] 23. Redesign Help as a help center (Dribbble-informed)
  - Rebuild `app/help/page.tsx`: deep-green search hero, topic card grid linking into the app, FAQ accordion, live search filtering topics and FAQs
  - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP
- The design document specifies TypeScript throughout, so all code will be written in TypeScript
- External services (MongoDB, Cloudinary, Gemini AI) require API keys - ensure these are obtained before implementation
- The project uses Next.js 16+ App Router conventions (not Pages Router)
- Checkpoints provide validation points to ensure core functionality works before proceeding
- The UI follows the green/black s.host-inspired design system with Material Design 3 (Google Cloud Console) conventions — see the Visual Design System section in design.md and Requirement 10 for tokens and patterns
- Property-based testing is not applicable for this feature (external integrations and UI rendering)
- Focus on integration tests to validate service interactions and API contracts

## Task Dependency Graph

```json
{
  "waves": [
    {
      "id": 0,
      "tasks": ["1"]
    },
    {
      "id": 1,
      "tasks": ["2.1", "3"]
    },
    {
      "id": 2,
      "tasks": ["2.2", "4.1"]
    },
    {
      "id": 3,
      "tasks": ["4.2", "4.3"]
    },
    {
      "id": 4,
      "tasks": ["4.4"]
    },
    {
      "id": 5,
      "tasks": ["4.5"]
    },
    {
      "id": 6,
      "tasks": ["5"]
    },
    {
      "id": 7,
      "tasks": ["6.1"]
    },
    {
      "id": 8,
      "tasks": ["6.2", "7.1"]
    },
    {
      "id": 9,
      "tasks": ["7.2"]
    },
    {
      "id": 10,
      "tasks": ["7.3", "7.4", "7.5"]
    },
    {
      "id": 11,
      "tasks": ["7.6", "7.7"]
    },
    {
      "id": 12,
      "tasks": ["8"]
    },
    {
      "id": 13,
      "tasks": ["9"]
    },
    {
      "id": 14,
      "tasks": ["10", "11"]
    },
    {
      "id": 15,
      "tasks": ["12"]
    },
    {
      "id": 16,
      "tasks": ["13"]
    },
    {
      "id": 17,
      "tasks": ["14"]
    },
    {
      "id": 18,
      "tasks": ["16", "17"]
    },
    {
      "id": 19,
      "tasks": ["15", "18"]
    },
    {
      "id": 20,
      "tasks": ["19"]
    },
    {
      "id": 21,
      "tasks": ["20", "21"]
    },
    {
      "id": 22,
      "tasks": ["22", "23"]
    }
  ]
}
```
