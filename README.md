# 📍 Real-Time Device Tracker

A real-time device tracking application built with Node.js, Express, Socket.io, and Leaflet.  
It captures live GPS coordinates using the browser Geolocation API and updates all connected users instantly on an interactive map.

---

## 🚀 Features

- Live GPS tracking
- Real-time updates using WebSockets
- Multiple users supported
- Interactive OpenStreetMap integration
- Auto-updating markers
- User disconnect handling
- Clean admin-style dashboard layout

---

## 🛠 Tech Stack

- Node.js
- Express
- Socket.io
- EJS
- Leaflet.js
- OpenStreetMap
- HTML/CSS/JavaScript

---

## 📂 Project Structure

RealTime-Tracker/
│
├── public/
│   ├── js/
│   ├── css/
│   └── assets/
│
├── views/
│   └── index.ejs
│
├── server.js
├── package.json
└── README.md

---

## ⚙️ Installation & Setup

### 1️⃣ Clone the repository

git clone https://github.com/your-username/your-repo-name.git
cd your-repo-name

### 2️⃣ Install dependencies

npm install

### 3️⃣ Run the server

node server.js

Server will run on:
http://localhost:3000

---

## 🌍 Deployment (Render Example)

1. Push project to GitHub  
2. Create new Web Service on Render  
3. Set:

Build Command:
npm install

Start Command:
node server.js

4. Make sure server uses dynamic port:

const PORT = process.env.PORT || 3000;
server.listen(PORT);

---

## 📡 How It Works

1. Browser requests geolocation permission  
2. Client sends coordinates to server via Socket.io  
3. Server broadcasts location to all connected clients  
4. Each client updates or creates a marker on the map  
5. When a user disconnects, their marker is removed  

---

## 🔮 Future Improvements

- User authentication
- MongoDB location history storage
- Admin dashboard controls
- Custom user avatars
- Dark mode UI
- Device tracking history trail
- Follow specific user feature

---
