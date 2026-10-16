# Requirements Document

## Introduction

The AI-Powered Plant Health Monitoring IoT System is a full-stack Next.js web application that receives telemetry data and images from ESP32-S3-CAM IoT devices, analyzes plant health using AI, and provides real-time monitoring capabilities through an interactive dashboard. The system integrates environmental sensors, image capture, cloud storage, AI-powered diagnostics, and data visualization to enable proactive plant health management.

## Glossary

- **System**: The complete AI-Powered Plant Health Monitoring IoT System including the Next.js web application, API endpoints, database, and integrations
- **IoT_Device**: ESP32-S3-CAM microcontroller with camera and environmental sensors
- **Telemetry_Endpoint**: POST /api/telemetry endpoint that receives data from IoT devices
- **History_Endpoint**: GET /api/telemetry/history endpoint that retrieves historical telemetry records
- **Dashboard**: Web interface displaying real-time plant health status and historical analytics
- **Telemetry_Data**: Environmental sensor readings including temperature, humidity, and soil moisture
- **Plant_Image**: JPEG image captured by the IoT device camera
- **AI_Engine**: Google Gemini AI service (gemini-2.5-flash model) used for plant health analysis
- **Health_Assessment**: Structured AI-generated analysis containing health score, status, diagnosis, and recommendations
- **Health_Score**: Numerical value from 0-100 indicating overall plant health
- **Status_Classification**: Categorical health indicator with values Healthy, Warning, or Critical
- **Database**: MongoDB instance storing telemetry records and health assessments
- **Image_Storage**: Cloudinary cloud storage service for plant images
- **Multipart_Request**: HTTP request with multipart/form-data encoding containing file and field data

## Requirements

### Requirement 1: IoT Data Ingestion

**User Story:** As an IoT device, I want to submit telemetry data and images to the system, so that plant health can be monitored and analyzed.

#### Acceptance Criteria

1. WHEN a Multipart_Request is received at the Telemetry_Endpoint with an image file, temperature, humidity, and soil moisture fields, THE System SHALL accept and parse all fields
2. THE Telemetry_Endpoint SHALL validate that temperature is a numeric value in degrees Celsius
3. THE Telemetry_Endpoint SHALL validate that humidity is a numeric value between 0 and 100 percent
4. THE Telemetry_Endpoint SHALL validate that soil moisture is a numeric value between 0 and 100 percent
5. WHEN the image file field is missing or empty, THE Telemetry_Endpoint SHALL return an HTTP 400 error response with a descriptive message
6. WHEN any required telemetry field is missing or invalid, THE Telemetry_Endpoint SHALL return an HTTP 400 error response with a descriptive message
7. WHEN all validation passes, THE Telemetry_Endpoint SHALL return an HTTP 200 success response

### Requirement 2: Image Storage Management

**User Story:** As a system administrator, I want plant images stored reliably in cloud storage, so that they are accessible for analysis and historical review.

#### Acceptance Criteria

1. WHEN a valid Plant_Image is received, THE System SHALL upload the image to Image_Storage using the Cloudinary SDK
2. THE System SHALL store the Cloudinary-generated public URL with the telemetry record
3. WHEN the upload to Image_Storage fails, THE System SHALL return an HTTP 500 error response
4. THE System SHALL accept JPEG format images from the IoT_Device
5. WHILE running in a development environment with Image_Storage not configured, THE System SHALL store the Plant_Image inline as a data URI (maximum 4MB) with a logged warning instead of returning an error; production behavior SHALL remain unchanged (HTTP 500)

### Requirement 3: Telemetry Data Persistence

**User Story:** As a system administrator, I want telemetry data persisted in the database, so that historical records are available for analysis and reporting.

#### Acceptance Criteria

1. WHEN telemetry data and image URL are received, THE System SHALL create a document in the Database with timestamp, temperature, humidity, soil moisture, and image URL fields
2. THE System SHALL generate a timestamp using the server time when the data is received
3. WHEN database write operations fail, THE System SHALL return an HTTP 500 error response
4. THE Database SHALL use MongoDB with Mongoose ODM for schema definition and data operations

### Requirement 4: AI-Powered Plant Health Analysis

**User Story:** As a plant owner, I want the system to analyze plant images with environmental context, so that I can identify health issues and receive actionable recommendations.

#### Acceptance Criteria

1. WHEN a Plant_Image has been successfully uploaded to Image_Storage and the Telemetry_Data has passed validation, THE System SHALL invoke the AI_Engine with the image and environmental metrics before persisting the telemetry record
2. THE System SHALL provide the AI_Engine with a maize-and-beans-specific system instruction covering: the fixed capture setup (two containers of young maize and common bean seedlings), crop-specific disease and deficiency indicators for maize (Zea mays) and common beans (Phaseolus vulgaris), pest checks, telemetry cross-referencing rules, environment ranges, a 0-100 scoring rubric with status mapping, and a strict-JSON output contract (authoritative text: SYSTEM_PROMPT in lib/gemini.ts)
3. THE System SHALL request the AI_Engine to generate a Health_Assessment containing health_score, status, diagnosis, and recommended_actions fields
4. THE System SHALL validate that the AI_Engine response contains a Health_Score between 0 and 100
5. THE System SHALL validate that the AI_Engine response contains a Status_Classification with value Healthy, Warning, or Critical
6. THE System SHALL store the Health_Assessment in the Database with the corresponding telemetry record
7. WHEN the AI_Engine fails to respond or returns invalid data, THE System SHALL log the error and store the telemetry record without health assessment data
8. THE AI_Engine SHALL use the gemini-2.5-flash model via the @google/genai SDK
9. THE System SHALL send the static system prompt as a Gemini system instruction, separate from the per-request content (telemetry text and image)
10. THE System SHALL attempt to reuse the system prompt across requests via Gemini explicit context caching with a one-hour TTL, and SHALL fall back to sending the system instruction inline when caching is unavailable (e.g. free-tier cache quota) or the cache has expired
11. WHEN the declared image MIME type is not an image type, THE System SHALL detect the actual type from the image bytes (WebP, PNG, or JPEG) before analysis and storage

### Requirement 5: Historical Telemetry Retrieval

**User Story:** As a dashboard user, I want to retrieve historical telemetry records, so that I can view trends and past health assessments.

#### Acceptance Criteria

1. WHEN the History_Endpoint receives a GET request, THE System SHALL retrieve telemetry records from the Database
2. THE History_Endpoint SHALL support an optional limit query parameter to restrict the number of records returned
3. WHEN a limit parameter is provided, THE System SHALL return at most that number of most recent records
4. WHEN no limit parameter is provided, THE System SHALL return the 100 most recent records
5. THE System SHALL sort telemetry records by timestamp in descending order (newest first)
6. THE History_Endpoint SHALL return records in JSON format containing all telemetry fields, timestamps, image URLs, and health assessments
7. WHEN the Database query fails, THE History_Endpoint SHALL return an HTTP 500 error response
8. WHEN a limit parameter is provided that is not a positive integer, THE History_Endpoint SHALL return an HTTP 400 error response with a descriptive message

### Requirement 6: Real-Time Monitoring Dashboard

**User Story:** As a plant owner, I want to view current plant health status and environmental conditions, so that I can monitor my plants in real-time.

#### Acceptance Criteria

1. THE Dashboard SHALL display the most recent Plant_Image
2. THE Dashboard SHALL display the current temperature reading with units (°C)
3. THE Dashboard SHALL display the current humidity reading with units (%)
4. THE Dashboard SHALL display the current soil moisture reading with units (%)
5. WHEN a Health_Assessment is available, THE Dashboard SHALL display the Health_Score
6. WHEN a Health_Assessment is available, THE Dashboard SHALL display the Status_Classification
7. WHEN a Health_Assessment is available, THE Dashboard SHALL display the diagnosis text
8. WHEN a Health_Assessment is available, THE Dashboard SHALL display the recommended actions
9. THE Dashboard SHALL retrieve data by calling the History_Endpoint with limit=1
10. THE Dashboard SHALL be accessible at the root route (/)

### Requirement 7: Historical Trend Visualization

**User Story:** As a plant owner, I want to see historical trends of environmental metrics, so that I can understand patterns and changes over time.

#### Acceptance Criteria

1. THE Dashboard SHALL display a time-series chart for temperature readings over time
2. THE Dashboard SHALL display a time-series chart for humidity readings over time
3. THE Dashboard SHALL display a time-series chart for soil moisture readings over time
4. THE Dashboard SHALL retrieve historical data by calling the History_Endpoint with limit=50
5. THE Dashboard SHALL use Recharts library for chart visualization
6. THE Dashboard SHALL display timestamps on the X-axis of charts
7. THE Dashboard SHALL display metric values on the Y-axis of charts

### Requirement 8: Auto-Refresh for Live Updates

**User Story:** As a plant owner, I want the dashboard to automatically refresh, so that I see the latest data without manual page reloads.

#### Acceptance Criteria

1. THE Dashboard SHALL automatically refresh data every 30 seconds by default; the interval SHALL be configurable (15, 30, or 60 seconds) via the Settings page
2. WHEN new data is fetched, THE Dashboard SHALL update all displayed metrics without full page reload
3. WHEN new data is fetched, THE Dashboard SHALL update all charts with new data points
4. THE Dashboard SHALL continue auto-refresh while the page is active

### Requirement 9: Database Connection Management

**User Story:** As a system administrator, I want database connections managed efficiently, so that the application performs reliably under load.

#### Acceptance Criteria

1. THE System SHALL establish a connection to the Database using a connection string from environment configuration
2. THE System SHALL reuse existing database connections across API requests
3. WHEN the Database connection is not established, THE System SHALL create a new connection before executing queries
4. THE System SHALL use Mongoose ODM for connection management

### Requirement 10: User Interface Design

**User Story:** As a plant owner, I want an intuitive and visually appealing interface, so that I can easily understand plant health status.

#### Acceptance Criteria

1. THE Dashboard SHALL use Tailwind CSS for styling
2. THE Dashboard SHALL use Lucide React icons for visual indicators
3. THE Dashboard SHALL display Status_Classification with color coding (green for Healthy, yellow for Warning, red for Critical)
4. THE Dashboard SHALL be responsive and functional on desktop and mobile devices
5. THE System SHALL use TypeScript for type safety across all components
6. THE Dashboard SHALL implement an application-shell layout with a near-black (#0C0E0D) sidebar navigation panel and a light neutral (#F4F6F5) content area, following the s.host-style green/black reference design
7. THE Dashboard SHALL use a lime-green accent color (#CDF463) for primary actions and active navigation states, and deep green (#17352C) for selected or emphasized surfaces
8. THE Dashboard SHALL present content in white cards with 12-16px rounded corners and subtle elevation, arranged on an 8px spacing grid per Material Design 3 conventions as used in Google Cloud Console
9. THE Dashboard SHALL style time-series charts with dark-green-family strokes (#14532D temperature, #16A34A humidity, #84CC16 soil moisture) and soft gradient area fills
10. THE Dashboard SHALL render Status_Classification as a soft-tinted pill badge and the Health_Score as a radial gauge visualization
11. THE Dashboard SHALL follow the Material Design 3 type-scale hierarchy using the Inter typeface, with large bold numerals for metric values
12. THE System SHALL use a custom design-system dropdown component (styled trigger with chevron, white popover options panel, deep-green selected state with check mark) in place of native select controls, site-wide
13. THE System SHALL display helper info icons with tooltip popovers beside charts and data cards, explaining what each one shows

### Requirement 11: Environment Configuration

**User Story:** As a system administrator, I want to configure external service credentials via environment variables, so that sensitive information is not hardcoded.

#### Acceptance Criteria

1. THE System SHALL read the MongoDB connection string from an environment variable
2. THE System SHALL read Cloudinary configuration (cloud name, API key, API secret) from environment variables
3. THE System SHALL read the Google Gemini API key from an environment variable
4. WHEN required environment variables are missing, THE System SHALL log a descriptive error message
5. WHEN required environment variables are missing, THE System SHALL return an HTTP 500 error for affected API requests

### Requirement 12: Device Simulator

**User Story:** As a developer, I want a simulator page where I can input telemetry values and maize-and-beans images, so that I can exercise the AI pipeline without a physical device and see the results in the main dashboard.

#### Acceptance Criteria

1. THE System SHALL serve a simulator page at the /simulator route using the design-system application shell
2. THE Simulator SHALL provide adjustable inputs for temperature, humidity, and soil moisture, with a control that randomizes all three values
3. THE Simulator SHALL allow choosing a local image file with a preview, and SHALL provide a bundled sample maize-and-beans image selectable with one click
4. WHEN submitted, THE Simulator SHALL send the values and image as a Multipart_Request to the Telemetry_Endpoint, identically to the IoT_Device
5. WHEN the submission succeeds, THE Simulator SHALL display the stored record's Health_Assessment (score gauge, status badge, diagnosis, recommended actions) and SHALL link to the Dashboard
6. WHEN the submission fails, THE Simulator SHALL display the error message returned by the Telemetry_Endpoint
7. THE sidebar navigation SHALL link to both the Dashboard and the Simulator with active-state highlighting

### Requirement 13: Reports and Analytics

**User Story:** As a plant owner, I want aggregated reports over historical telemetry, so that I can understand long-term conditions and plant health trends.

#### Acceptance Criteria

1. THE System SHALL serve a reports page at the /reports route using the design-system application shell, linked from the sidebar with active-state highlighting
2. THE Reports page SHALL let the user select the analysis window (25, 50, 100, or 200 most recent records), defaulting to the window chosen in Settings, and retrieve data via the History_Endpoint
3. THE Reports page SHALL display summary statistics (average, minimum, maximum) for temperature, humidity, and soil moisture over the window
4. THE Reports page SHALL display the average Health_Score and the count of assessed records in the window
5. THE Reports page SHALL display the Status_Classification distribution with color-coded proportion bars (green/yellow/red)
6. THE Reports page SHALL display a Health_Score-over-time chart and a combined environmental metrics chart with a legend
7. THE Reports page SHALL present two tabs, Insights and Records; the Records tab SHALL display the full capture log for the window (time, metrics, score, status badge)
8. THE Reports page SHALL provide a CSV export of the records in the current window

### Requirement 14: Health Alert Notifications

**User Story:** As a plant owner, I want to be alerted to unhealthy assessments, so that I never miss a plant problem.

#### Acceptance Criteria

1. THE System SHALL display a notifications bell icon at the top right of every page header
2. THE System SHALL treat recent telemetry records with Status_Classification Warning or Critical as notifications
3. WHEN unread notifications exist, THE System SHALL display a green dot on the bell icon
4. WHEN the bell is clicked, THE System SHALL show a panel listing recent notifications (status badge, score, timestamp, diagnosis excerpt), newest first
5. WHEN the panel is opened, THE System SHALL mark all notifications as read and persist the read state in browser storage
6. THE System SHALL refresh notifications periodically (every 60 seconds) without a page reload
7. THE notification behavior SHALL respect the Settings page preferences (alerts enabled/disabled; Warning and Critical, or Critical only)

### Requirement 15: Application Settings

**User Story:** As a plant owner, I want to configure how the app refreshes and alerts, so that it fits how I monitor my plants.

#### Acceptance Criteria

1. THE System SHALL serve a settings page at the /settings route using the design-system application shell, linked from the sidebar with active-state highlighting
2. THE Settings page SHALL let the user configure the Dashboard auto-refresh interval (15, 30, or 60 seconds; default 30)
3. THE Settings page SHALL let the user enable or disable health alert notifications and choose which statuses raise alerts (Warning and Critical, or Critical only)
4. THE Settings page SHALL let the user choose the default Reports analysis window (25, 50, 100, or 200 records; default 100)
5. THE System SHALL persist settings in browser localStorage, save them as they are changed, and apply them to open pages without a reload
6. THE Settings page SHALL display the device telemetry endpoint URL with a copy control

### Requirement 16: Help and Usage Guide

**User Story:** As a user, I want a general navigation and usage guide, so that I can understand what each part of the app does.

#### Acceptance Criteria

1. THE System SHALL serve a help page at the /help route using the design-system application shell, linked from the sidebar with active-state highlighting
2. THE Help page SHALL explain the end-to-end system flow (device capture → AI analysis → storage → dashboard)
3. THE Help page SHALL describe how to navigate and use each page (Dashboard, Simulator, Reports, Settings) and the notifications bell
4. THE Help page SHALL document the status/score color language and the device connection contract (endpoint and required fields)
5. THE Help page SHALL follow the help-center pattern: a search hero, a grid of topic cards for each area of the app, and an FAQ accordion, with search filtering topics and FAQs live

### Requirement 17: Email Alert Notifications

**User Story:** As a plant owner, I want to register an email address and receive an email when my plants are critical, so that I am alerted with the details and what to do even when I am not watching the dashboard.

#### Acceptance Criteria

1. THE Settings page SHALL let the Plant_Owner register an email address for health alerts and turn email alerts on or off
2. THE System SHALL store the email alert configuration server-side in the Database
3. WHEN email alerts are enabled without a valid email address, THE System SHALL reject the save with an HTTP 400 error
4. WHEN a Health_Assessment with Status_Classification Critical is stored AND email alerts are enabled, THE System SHALL send an email to the registered address containing the health score, the diagnosis, the recommended actions, and the telemetry at capture
5. THE System SHALL send at most one alert email per hour
6. THE System SHALL send email via the Resend API, reading RESEND_API_KEY and optional ALERT_FROM_EMAIL (defaulting to Resend's test sender) from environment variables; WHILE the key is not configured in a development environment, THE System SHALL render the email to the server log instead of sending
7. Email failures SHALL never fail telemetry ingestion (non-blocking, logged)
