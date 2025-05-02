# Focus Guard

A smart productivity tool that helps you maintain focus during work or study sessions using face tracking technology.

View the offical site at: https://focus-guard.vercel.app/


https://user-images.githubusercontent.com/<...>/FocusGuard-DemoVideo.mp4


## Features

### Core Features

- **Smart Pomodoro Timer**: Customizable focus, short break, and long break intervals
- **AI-Powered Face Tracking**: Detects when you look away from the screen and automatically pauses your focus timer
- **Focus Statistics**:
  - Track your daily/weekly/monthly focus time
  - Monitor attention losses
  - View focus quality score
  - See attention improvement metrics
  - Track daily streaks with a visual calendar

### Integration Features

- **Spotify Integration**: Connect your Spotify account to play focus music during sessions
- **User Authentication**: Sign in with Google or email/password
- **Social Features**: Connect with friends to share progress and stay motivated
- **Dark/Light Mode**: Toggle between theme preferences

## Technology Stack

### Frontend

- **React 19**: UI library
- **React Router**: Navigation and routing
- **Chart.js & React-Chartjs-2**: Data visualization for statistics
- **React Webcam**: Camera access for face tracking
- **React Three Fiber & Drei**: 3D graphics capabilities

### Computer Vision

- **MediaPipe**: Face tracking and detection
  - Face Detection
  - Face Mesh
  - Camera Utils
  - Drawing Utils
- **TensorFlow.js**: Machine learning capabilities
  - WASM Backend
  - WebGL Backend

### Backend Services

- **Firebase**:
  - Authentication
  - Firestore Database
  - Firebase Storage
- **Vercel**: Hosting and serverless functions

### Authentication & APIs

- **Google Auth**: User login
- **Spotify API**: Music integration

### UI Enhancement

- **GSAP**: Animations
- **Lottie React**: Vector animations
- **TSParticles**: Particle effects

## Getting Started

### Prerequisites

- Node.js
- npm or yarn
- A Firebase account

### Installation

1. Clone the repository

```bash
git clone https://github.com/yourusername/focus-guard.git
cd focus-guard
```

2. Install dependencies

```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:

```
REACT_APP_FIREBASE_API_KEY=your_firebase_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
REACT_APP_FIREBASE_PROJECT_ID=your_firebase_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
REACT_APP_FIREBASE_APP_ID=your_firebase_app_id
REACT_APP_FIREBASE_MEASUREMENT_ID=your_firebase_measurement_id
```

4. Start the development server

```bash
npm start
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

### Setting Up Your Timer

1. Customize focus and break durations in the Settings
2. Toggle face tracking on/off
3. Enable/disable sound notifications

### Using Face Tracking

1. Allow camera access when prompted
2. Position yourself in view of the camera
3. Start your focus session
4. The timer will automatically pause when you look away

### Tracking Progress

1. Check your daily statistics
2. View your focus quality score
3. Monitor your streak calendar

### Connecting with Friends

1. Add friends via email
2. View shared progress
3. Compete on leaderboards
