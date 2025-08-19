# Smart Attendance Management System

## Overview

This is a comprehensive Smart Attendance Management System built with a full-stack TypeScript architecture. The system integrates facial recognition, RFID card scanning, and hardware components (ESP32-CAM) to automatically track student attendance. It features role-based access for administrators, lecturers, and students, with real-time updates and comprehensive reporting capabilities.

The application combines a React frontend with a Node.js/Express backend, a Python-based facial recognition service, Firebase for real-time data synchronization, and Arduino-based hardware for physical attendance capture.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite for development
- **UI Library**: Shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack Query for server state, React Context for authentication
- **Routing**: Wouter for client-side routing
- **Real-time Updates**: WebSocket integration and Firebase Firestore listeners

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Session Management**: Express sessions with PostgreSQL store
- **Authentication**: Simple token-based authentication (designed for JWT upgrade)
- **Real-time Communication**: WebSocket server for live attendance updates
- **API Design**: RESTful endpoints with role-based access control

### Face Recognition Service
- **Framework**: Python Flask application
- **Computer Vision**: OpenCV and face_recognition library
- **Face Processing**: Real-time face detection, encoding, and matching
- **Storage**: Local pickle files for face encodings with Firebase backup
- **Integration**: HTTP API endpoints for enrollment and recognition

### Database Design
- **Primary Database**: PostgreSQL with Drizzle schema definitions
- **Tables**: Users, Students, Lecturers, Classes, Attendance Records, Hardware Devices
- **Relationships**: Foreign key constraints with proper referential integrity
- **Features**: UUID primary keys, timestamp tracking, JSONB for flexible data storage

### Hardware Integration
- **Device**: ESP32-CAM modules for image capture
- **Communication**: HTTP REST API between hardware and Python service
- **Protocols**: WiFi connectivity with JSON data exchange
- **Backup Methods**: RFID card scanning as secondary authentication

### Authentication & Authorization
- **Multi-role System**: Admin, Lecturer, and Student roles with different permissions
- **Session Management**: Server-side session storage with PostgreSQL
- **Protected Routes**: Role-based route protection on both frontend and backend
- **Security**: Input validation, sanitization, and error handling

## External Dependencies

### Database Services
- **PostgreSQL**: Primary relational database (configurable via DATABASE_URL)
- **Connection**: Neon serverless PostgreSQL driver for cloud deployment

### Real-time Services
- **Firebase**: Firestore for real-time attendance updates and hardware status
- **WebSocket**: Native WebSocket server for live frontend updates

### Third-party Libraries
- **Face Recognition**: Python face_recognition library with dlib backend
- **UI Components**: Radix UI primitives for accessible component foundation
- **Form Handling**: React Hook Form with Zod validation
- **Styling**: Tailwind CSS with class-variance-authority for component variants

### Hardware Components
- **ESP32-CAM**: WiFi-enabled camera modules for image capture
- **RFID Readers**: Backup authentication method
- **Arduino IDE**: Development environment for hardware programming

### Development Tools
- **Vite**: Frontend build tool and development server
- **TypeScript**: Type checking and development tooling
- **Drizzle Kit**: Database migration and schema management
- **ESBuild**: Backend bundling for production deployment

### Cloud Services
- **Firebase**: Real-time database and authentication services
- **Replit**: Development environment with built-in deployment