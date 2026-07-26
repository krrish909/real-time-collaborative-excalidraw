# Collaborative Excalidraw Clone

A real-time collaborative whiteboard application inspired by Excalidraw, allowing multiple users to draw, edit, and collaborate on the same canvas simultaneously.

Built with modern full-stack technologies including React, TypeScript, WebSockets, Redis Pub/Sub, Prisma, PostgreSQL, and Docker.

---

## 🚀 Features

### Authentication
- User signup and login
- JWT based authentication
- Secure API authorization

### Whiteboard Canvas
- Infinite canvas
- Pan and zoom support
- Shape-based drawing engine
- Create, update, and delete shapes
- Undo/Redo functionality
- Import and export boards

### Real-Time Collaboration
- Real-time drawing synchronization using WebSockets
- Multi-user collaboration
- Live collaborator cursor tracking
- Operation-based synchronization
- Redis Pub/Sub for scalable communication

### Backend
- REST API architecture
- WebSocket server
- Prisma ORM integration
- PostgreSQL databae
- Redis caching and Pub/Sub messaging

### DevOps
- Dockerized frontend and backend
- Docker Compose orchestration
- Container-based development environment

---

# 🏗️ System Architecture
                     Client Browser

                       |
                       |

          React + TypeScript Frontend
                (Docker Container)

                       |
                       |

      Node.js + Express Backend Server
          WebSocket + REST API
                (Docker Container)

                /              \

               /                \

      PostgreSQL Database        Redis
         Prisma ORM            Pub/Sub
---

# 🛠️ Tech Stack

## Frontend
- React
- TypeScript
- Vite
- WebSocket Client

## Backend
- Node.js
- Express.js
- TypeScript
- Prisma ORM
- JWT Authentication
- WebSocket (ws)

## Database & Infrastructure
- PostgreSQL
- Redis
- Docker
- Docker Compose

---

# 📂 Project Structure
├── client
│ ├── src
│ ├── Dockerfile
│ └── package.json
│
├── server
│ ├── src
│ ├── prisma
│ ├── Dockerfile
│ └── package.json
│
└── docker-compose.yml

---

# ⚙️ Running Locally

