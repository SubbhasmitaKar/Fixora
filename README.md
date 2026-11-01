# Fixora: Trusted Local Services

Create a full-stack web application called "Fixora" — a scalable Local Services Booking Platform with real-world commercial potential.

-----------------------------------

🧠 PROJECT OVERVIEW:

Fixora is a digital marketplace that connects users with verified local service providers (electricians, plumbers, tutors, beauticians, etc.). The platform enables seamless service discovery, booking, management, and monetization.

The goal is to build a production-level application that demonstrates full-stack development, business logic, and scalability suitable for a final-year CSE project.

-----------------------------------

🎨 FRONTEND REQUIREMENTS:

Use React.js with Tailwind CSS.

Design Guidelines:

- Modern, clean UI with gradient theme (blue → purple)

- Glassmorphism / card-based layout

- Fully responsive (mobile + desktop)

- Smooth UX with clear navigation

Pages to implement:

1. Home Page

- Hero section with tagline: “Book Trusted Services Instantly”

- Service categories (Electrician, Plumber, Tutor, Beautician, etc.)

- Call-to-action buttons

2. Authentication

- Login / Signup

- Role selection (User / Provider)

- Form validation

3. Services Listing Page

- Service cards (title, price, rating, location)

- Search bar

- Filters (category, price range, rating, location)

4. Service Details Page

- Provider details

- Description

- Ratings & reviews

- “Book Now” button

5. Booking Page

- Select date and time

- Confirm booking UI

6. Dashboards (Role-Based):

a. User Dashboard:

   - Booking history

   - Status tracking

b. Provider Dashboard:

   - Add/manage services

   - View booking requests

   - Accept/reject bookings

   - Earnings overview

c. Admin Dashboard:

   - Manage users/providers

   - View all bookings

   - Platform analytics

-----------------------------------

⚙️ BACKEND REQUIREMENTS:

Use Node.js with Express.js.

Implement RESTful APIs for:

- Authentication (JWT-based)

- Role-based authorization

- User management

- Service management

- Booking system

- Review system

Include:

- Password hashing (bcrypt)

- Input validation

- Error handling middleware

-----------------------------------

🗄️ DATABASE DESIGN (MongoDB):

Users:

- name

- email

- password

- role (user/provider/admin)

- location

Services:

- title

- category

- price

- description

- providerId

- location

- rating (average)

Bookings:

- userId

- serviceId

- date

- time

- status (pending, accepted, completed, cancelled)

Reviews:

- userId

- serviceId

- rating (1–5)

- comment

-----------------------------------

🔑 CORE LOGIC (IMPORTANT):

1. Booking System:

- Prevent double booking (no overlapping time slots)

- Track booking lifecycle (pending → accepted → completed)

2. Recommendation System:

- Show top-rated or most-booked services

3. Location Filtering:

- Filter services by city/location

4. Notification System (Basic):

- Show booking updates in UI (accepted/rejected)

-----------------------------------

💰 MONETIZATION FEATURES:

- Apply commission (e.g., 10%) on each booking

- Track provider earnings

- Display earnings dashboard for providers

- Add “featured service” UI option (paid promotion concept)

-----------------------------------

📊 DASHBOARD ANALYTICS:

User:

- Booking history

Provider:

- Total bookings

- Earnings summary

Admin:

- Total users

- Total bookings

- Revenue overview

-----------------------------------

🔐 SECURITY:

- JWT authentication

- Protected routes

- Input validation

- Secure password storage

-----------------------------------

📦 OUTPUT REQUIRED:

- Clean folder structure (frontend + backend)

- Fully functional code

- API endpoints with examples

- Sample dummy data

- Setup instructions to run locally

-----------------------------------

🎯 FINAL EXPECTATION:

The application should simulate a real startup product (Fixora), demonstrating strong UI/UX, business logic, scalability, and monetization potential. It should be suitable for academic evaluation and future commercial expansion.

## Development

Install Node.js and npm, copy `.env.example` to `.env`, and set the Supabase
publishable key for the configured project. Keep `SUPABASE_SERVICE_ROLE_KEY`
server-only; never add a `VITE_` prefix to it. Then install dependencies and
start the development server:

```sh
cp .env.example .env
npm install
npm run dev
```

Use `npm run build` to create a production build and `npm run lint` to check the
codebase. For deployment, configure the same environment variables in the
hosting provider and add the deployed site URL to Supabase's allowed
authentication redirect URLs.
