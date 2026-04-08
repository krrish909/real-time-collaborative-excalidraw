This project is a fully custom-built interactive whiteboard application developed using React, TypeScript, and HTML Canvas.
While inspired by tools like Excalidraw, the focus of this project is on core canvas engine design, geometry-based interaction, and state-driven architecture, rather than UI polish.

The application supports freehand drawing, shape creation, selection, editing, undo/redo, export/import, and grid-based alignment — all implemented from scratch without external drawing libraries.
Key Features
🎨 Drawing Tools

Freehand Pen tool

Rectangle tool

High-DPI canvas rendering for sharp visuals

🧠 Intelligent Selection & Editing

Geometry-based selection for pen strokes (point-to-line distance math)

Bounding-box selection for rectangles

Drag & move support for both pens and shapes

Visual highlighting of selected objects

⏪ History Management

Undo / Redo support

Keyboard shortcuts (Ctrl+Z, Ctrl+Y)

Safe state snapshots using immutable history stacks

🗑️ Editing Controls

Delete selected shapes using the Delete key

Clear canvas functionality

💾 Persistence & Export

Export drawing as PNG

Export canvas state as JSON

Import JSON to fully restore previous drawings

📐 Productivity Enhancements

Toggleable grid background

Optional snap-to-grid alignment

Keyboard-driven interactions

🧩 Technical Architecture
Object Model

All drawable elements are modeled as structured objects:

Shape = Pen | Rectangle


Each shape:

Has a unique ID

Is stored in an object-based state system

Can be selected, moved, deleted, and serialized

Geometry & Hit Testing

Rectangle selection uses bounding-box checks

Pen stroke selection uses point-to-segment distance calculations

This avoids pixel-based hacks and enables precise interaction

Rendering Strategy

Stateless redraws from source-of-truth shape data

No direct pixel mutation

Canvas is fully re-rendered on every interaction

🛠️ Tech Stack

Frontend: React + TypeScript

Graphics: HTML5 Canvas API

State Management: React Hooks (useRef, useState)

No external drawing libraries used

▶️ Getting Started
Prerequisites

Node.js (v16+ recommended)

npm / pnpm / yarn

Installation
git clone <your-repo-url>
cd <project-folder>
npm install
npm run dev


Open your browser at:

http://localhost:5173

📷 Demo Capabilities

Draw shapes and freehand strokes

Select and move objects

Undo / redo changes

Export drawings as PNG or JSON

Import previous sessions

Use grid and snap-to-grid for precision

📄 Project Motivation

The goal of this project was not to recreate Excalidraw’s UI, but to:

Understand how drawing engines work internally

Implement geometry-based interaction logic

Build a scalable canvas architecture from first principles

Gain hands-on experience with real-time graphical systems

🧠 What This Project Demonstrates

Strong understanding of canvas rendering

Experience with computational geometry

Clean state management without heavy frameworks

Ability to design systems beyond tutorials

Production-minded frontend engineering

📈 Future Enhancements (Optional)

Text tool support

Resize handles for shapes

Multi-user collaboration (WebSockets)

Zoom & pan

Layer management

🧑‍💻 Author

Built by [krrish]
ECE Undergraduate|
