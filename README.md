# MealFlow - Professional Meal Planning System

MealFlow is a full-stack web application designed for families and shared households to coordinate weekly meal planning, maintain a collaborative dish repository, and manage synchronized shopping lists.

## Technical Stack

### Frontend
- React 18 with TypeScript
- Vite Build System
- Tailwind CSS for responsive utility-first styling
- Framer Motion (motion/react) for fluid UI transitions
- Lucide React for consistent iconography
- Recharts for data visualization (where applicable)

### Backend
- Node.js with Express
- MongoDB with Mongoose ODM
- JSON Web Tokens (JWT) for secure authentication
- Gemini AI Integration for automated meal plan generation

### Deployment and Infrastructure
- Containerized environment (Cloud Run)
- Nginx reverse proxy
- Environment-based configuration

## Core Features

### 1. Authentication and Collaboration
- Secure user registration and login system.
- Group-based architecture: Users can create or join multiple groups.
- Shared state: All members of a group see real-time updates to dishes, plans, and shopping lists.

### 2. Dish Repository
- Centralized database of meals available to the group.
- Categorization (Breakfast, Lunch, Dinner, Snack).
- Ingredient management per dish.
- Search and filtering capabilities.

### 3. Weekly Planner
- Calendar view for organizing meals across the week.
- Slot-based planning (Lunch and Dinner).
- Drag-and-drop or selection-based assignment.
- AI-Powered Generation: Uses Gemini to suggest a balanced weekly menu based on the group's specific dish repository.
- Weekly persistence: Historical plans are stored and accessible via a week selector.

### 4. Interactive Shopping List
- Automated aggregation: Summarizes all ingredients needed for the currently planned week.
- Persistent "To Buy" list: Items can be moved from suggestions to a cross-device persistent checklist.
- Category-based sorting for efficient grocery store navigation.
- Real-time synchronization: Purchased status updates for all group members.

### 5. Sharing Functionality
- Direct integration with WhatsApp and Email.
- Generates formatted text summaries of the current week's meal plan for external communication.

## Functionalities

### Automatic Menu Generation
The system utilizes AI to analyze the available dishes in the repository. It ensures variety by avoiding repetition and attempting to balance categories across the seven-day period.

### Data persistence
All data, including partially checked shopping lists and historical meal plans, is stored in a MongoDB database rather than local storage. This ensures that a user starting a list on a desktop can see the same items on their mobile device while at the store.

### Responsive Design
The platform provides a specific mobile interface with a bottom navigation bar and touch-optimized interactive elements, while presenting a sidebar-driven dashboard on desktop resolutions.

## Installation and Configuration

### Prerequisites
- Node.js (Latest LTS recommended)
- MongoDB instance
- Gemini API Key

### Environment Variables
Configure the following in your environment or .env file:
- DATABASE_URL: MongoDB connection string
- JWT_SECRET: Secret for token signing
- GEMINI_API_KEY: For AI features

### Development
```bash
npm install
npm run dev
```

### Production Build
```bash
npm run build
npm start
```
