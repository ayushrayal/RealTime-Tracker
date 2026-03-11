const express = require("express");
const app = express();
const http = require("http");
const socketio = require("socket.io");
const path = require("path");

const server = http.createServer(app);
const io = socketio(server);

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

// In-memory store of all currently connected users
// Structure: { socketId: { name, latitude, longitude } }
const users = {};

io.on("connection", function (socket) {
    console.log(`[+] New connection: ${socket.id}`);

    // ── Step 1: Send existing users to the newcomer immediately ──────────────
    // This fixes the bug where new users couldn't see who was already connected.
    socket.emit("existing-users", users);

    // ── Step 2: User registers their callsign ─────────────────────────────────
    socket.on("set-username", function (name) {
        const safeName = (String(name || "").trim().slice(0, 20)) || "Anonymous";
        users[socket.id] = { name: safeName, latitude: null, longitude: null };

        // Tell EVERYONE (including the new user) that someone joined
        io.emit("user-joined", { id: socket.id, name: safeName });
        console.log(`[+] User set name: ${safeName} (${socket.id})`);
    });

    // ── Step 3: User broadcasts their GPS coordinates ─────────────────────────
    socket.on("send-location", function (data) {
        // Guard: ignore location events before username is set
        if (!users[socket.id]) return;

        users[socket.id].latitude  = data.latitude;
        users[socket.id].longitude = data.longitude;

        // Broadcast to ALL clients so every map updates in real time
        io.emit("receive-location", {
            id:        socket.id,
            name:      users[socket.id].name,
            latitude:  data.latitude,
            longitude: data.longitude,
        });
    });

    // ── Step 4: Cleanup when user leaves ──────────────────────────────────────
    socket.on("disconnect", function () {
        const user = users[socket.id];
        if (user) {
            console.log(`[-] Disconnected: ${user.name} (${socket.id})`);
            delete users[socket.id];
            // Note: event name is "user-disconnect", NOT "disconnect"
            // Client's own "disconnect" event has no payload
            io.emit("user-disconnect", { id: socket.id, name: user.name });
        }
    });
});

app.get("/", function (req, res) {
    res.render("index");
});

server.listen(3000, () => {
    console.log("Server running → http://localhost:3000");
});