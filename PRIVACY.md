# PinMind Privacy Policy

Effective date: May 29, 2026

PinMind is an AI-powered visual organization app that helps users discover, upload, analyze, and save images into private boards. This Privacy Policy explains what information PinMind collects, how it is used, and what choices you have.

This policy is a practical template for the current PinMind app. It is not legal advice. Before using PinMind publicly or submitting it for production OAuth review, have the final policy reviewed for your jurisdiction and business setup.

## 1. Information We Collect

### Account information

When you sign in with Google, PinMind receives basic account information through Supabase Auth, such as:

- your Supabase user id
- your email address
- your display name
- your profile avatar, if available

PinMind does not receive or store your Google password.

### Content you create or save

PinMind stores the content needed to operate your private workspace, including:

- boards you create
- pins you save
- image URLs
- uploaded image storage paths
- board names, descriptions, tags, and visual identity metadata
- AI analysis results, such as generated titles, descriptions, tags, objects, colors, mood, style, category, confidence score, and board decision

### Uploaded images

When you upload an image, PinMind sends it to the backend and stores it in Supabase Storage. The image is then saved as a pin if the Smart Save flow auto-saves it or if you confirm/save it.

### Image library searches

When you search the Explore library, PinMind sends your search query to the PinMind backend. The backend may request image results from optional providers such as Pexels or Unsplash. PinMind normalizes those image results before showing them in the app.

### Technical information

PinMind and its hosting providers may process technical information needed to run and secure the service, such as:

- browser and device information
- request logs
- IP address
- error logs
- authentication status
- API route usage

## 2. How We Use Information

PinMind uses your information to:

- sign you in and keep your session active
- show your private boards and pins
- save uploaded images and image-library selections
- analyze images with AI vision
- recommend the best board for each image
- suggest new boards when an image does not match your existing boards
- improve reliability, debugging, and security
- prevent users from seeing another user's private boards or pins

## 3. AI Image Analysis

PinMind may send uploaded images or image URLs to a backend AI vision provider, such as Gemini, to generate:

- title
- description
- detected tags
- objects or subjects
- style and aesthetic
- colors
- mood
- category
- board recommendation
- confidence score

AI calls happen from the backend only. Gemini API keys and other backend secrets are not exposed to the frontend.

If no AI provider is configured, PinMind may use a mock analyzer for development and testing.

## 4. Third-Party Services

PinMind uses third-party services to operate the app:

- **Supabase**: authentication, database, and storage
- **Google OAuth**: Google sign-in
- **Vercel**: frontend and backend hosting
- **Gemini or other AI providers**: image analysis, if configured
- **Pexels and Unsplash**: optional image discovery providers

These providers may process information according to their own privacy policies.

## 5. Data Sharing

PinMind does not sell your personal information.

PinMind may share or process information with service providers only as needed to operate the app, including authentication, hosting, database storage, image storage, AI analysis, and image discovery.

Image library providers receive search queries from the backend when you use Explore search. They do not receive your Supabase service role key, Gemini key, or private backend secrets.

## 6. User-Scoped Data and Access Controls

PinMind is designed so each logged-in user can only access their own boards, pins, AI predictions, and saved images.

The backend verifies Supabase access tokens on protected API requests and uses the authenticated user id for reads and writes. Database Row Level Security policies are configured to restrict user data by `auth.uid()`.

## 7. Data Retention

PinMind keeps your account data, boards, pins, uploaded images, and AI metadata for as long as your account or workspace remains active, unless deletion is requested or implemented through the app.

Some provider logs may be retained by Supabase, Vercel, Google, Gemini, Pexels, or Unsplash according to their own retention policies.

## 8. Your Choices

You can:

- sign out of PinMind
- choose not to upload images
- choose not to save images from the Explore library
- request deletion of your account data by contacting the PinMind operator

Future versions may add self-service account deletion, private storage buckets, and more detailed data export/deletion tools.

## 9. Security

PinMind uses authentication, protected backend API routes, and database access controls to help protect user data.

Backend secrets such as Supabase service role keys, Gemini keys, Pexels keys, and Unsplash keys are intended to be stored only in backend environment variables. They should never be placed in frontend code or frontend environment variables.

No internet service can be guaranteed completely secure, but PinMind is designed to reduce accidental exposure of private user data.

## 10. Children's Privacy

PinMind is not intended for children under 13. If you believe a child has provided personal information through PinMind, contact the PinMind operator so the information can be reviewed or deleted.

## 11. International Users

PinMind may use service providers that process data in different countries. By using PinMind, you understand that your information may be processed where PinMind or its providers operate.

## 12. Changes to This Policy

PinMind may update this Privacy Policy as the app changes. The effective date at the top of this document will be updated when material changes are made.

## 13. Contact

For privacy questions or data deletion requests, contact:

```text
Operator: PinMind
Email: rishitbanker314@gmail.com
Website: https://pinmind-frontend.vercel.app
```
