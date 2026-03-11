/* ═══════════════════════════════════════════════════════════════════════════
   LiveTrack — script.js
   All client-side logic: map, socket events, markers, lines, UI
═══════════════════════════════════════════════════════════════════════════ */

const socket = io();

/* ── STATE ──────────────────────────────────────────────────────────────── */
const markers  = {};   // socketId → L.marker
const userInfo = {};   // socketId → { name, latitude, longitude }
let myId       = null; // Our own socket.id, set on "Deploy"
let myLocation = null; // Our latest { latitude, longitude }
let firstFix   = false;// Has the map been centered on us yet?
let panelOpen  = true;

/* ── MAP INITIALISATION ─────────────────────────────────────────────────── */
const map = L.map("map", { zoomControl: true }).setView([20, 0], 2);

// CartoDB Dark Matter tiles — a proper dark map, no filter hacks needed
L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/">CARTO</a>',
    subdomains: "abcd",
    maxZoom: 20,
}).addTo(map);

// Separate layer group for the dashed connection lines (easy to wipe & redraw)
const linesGroup = L.layerGroup().addTo(map);

/* ── MODAL — USERNAME ENTRY ─────────────────────────────────────────────── */
const modal        = document.getElementById("username-modal");
const joinBtn      = document.getElementById("join-btn");
const nameInput    = document.getElementById("username-input");

// Allow pressing Enter in the input
nameInput.addEventListener("keydown", e => { if (e.key === "Enter") joinBtn.click(); });

joinBtn.addEventListener("click", () => {
    // Make sure the socket is ready
    if (!socket.connected) {
        showNotification("⚠ Connecting… please try again");
        return;
    }

    const name = nameInput.value.trim() || "Agent_" + Math.floor(Math.random() * 9000 + 1000);
    myId   = socket.id;
    myName = name;

    socket.emit("set-username", name);
    modal.classList.remove("active");
    document.getElementById("my-name-display").textContent = name;
    startTracking();
});

/* ── GEOLOCATION ─────────────────────────────────────────────────────────── */
function startTracking() {
    if (!navigator.geolocation) {
        showNotification("⚠ Geolocation not supported by your browser");
        return;
    }

    navigator.geolocation.watchPosition(
        pos => {
            const { latitude, longitude } = pos.coords;
            myLocation = { latitude, longitude };
            socket.emit("send-location", { latitude, longitude });
        },
        err => {
            console.error("Geolocation error:", err);
            showNotification("⚠ Location access denied — enable GPS");
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
}

/* ── MARKERS ─────────────────────────────────────────────────────────────── */
function buildIcon(name, isMe) {
    // DivIcon lets us put custom HTML at the marker location
    return L.divIcon({
        className: "",           // no default leaflet styles
        html: `
          <div class="custom-marker ${isMe ? "my-marker" : "other-marker"}">
            <div class="marker-pulse"></div>
            <div class="marker-dot"></div>
            <div class="marker-label">${esc(name)}</div>
          </div>`,
        iconSize:   [0, 0],      // size 0 — our CSS handles the visual footprint
        iconAnchor: [7, 7],      // offset so the dot centre sits on the coordinate
    });
}

function placeOrUpdateMarker(id, name, lat, lng) {
    const isMe = id === myId;

    if (markers[id]) {
        // Marker already exists — just slide it to the new position
        markers[id].setLatLng([lat, lng]);
    } else {
        // First time we've seen this user — create a fresh marker
        const mk = L.marker([lat, lng], { icon: buildIcon(name, isMe) }).addTo(map);
        mk.on("click", () => map.flyTo(mk.getLatLng(), 16, { animate: true, duration: 0.8 }));
        markers[id] = mk;
    }

    userInfo[id] = { ...userInfo[id], name, latitude: lat, longitude: lng };
}

/* ── CONNECTION LINES ─────────────────────────────────────────────────────── */
// Called after every location update — clears and redraws all dashed lines
function redrawLines() {
    linesGroup.clearLayers();

    // Only draw for users who have a real position
    const active = Object.entries(userInfo).filter(
        ([, u]) => u.latitude != null && u.longitude != null
    );

    if (active.length < 2) return;

    // Every unique pair gets one dashed line
    for (let i = 0; i < active.length; i++) {
        for (let j = i + 1; j < active.length; j++) {
            const [, u1] = active[i];
            const [, u2] = active[j];
            L.polyline(
                [[u1.latitude, u1.longitude], [u2.latitude, u2.longitude]],
                { color: "#00d4aa", weight: 1.5, opacity: 0.35, dashArray: "6 12" }
            ).addTo(linesGroup);
        }
    }
}

/* ── USER LIST PANEL ─────────────────────────────────────────────────────── */
function updateUserList() {
    const list    = document.getElementById("user-list");
    const counter = document.getElementById("user-count");
    const entries = Object.entries(userInfo);

    counter.textContent = entries.length;
    list.innerHTML = "";

    entries.forEach(([id, u]) => {
        const isMe = id === myId;
        const div  = document.createElement("div");
        div.className = `user-item ${isMe ? "me" : "other"}`;

        div.innerHTML = `
          <span class="user-status-dot"></span>
          <div class="user-item-info">
            <div class="user-item-name">
              ${esc(u.name)}${isMe ? ' <em>(you)</em>' : ""}
            </div>
            <div class="user-item-coords">
              ${u.latitude != null
                ? `${u.latitude.toFixed(4)}, ${u.longitude.toFixed(4)}`
                : "Acquiring signal…"}
            </div>
          </div>`;

        // Click on another user's row → fly to their marker
        if (!isMe && u.latitude != null) {
            div.title = `Fly to ${u.name}`;
            div.style.cursor = "pointer";
            div.addEventListener("click", () =>
                map.flyTo([u.latitude, u.longitude], 16, { duration: 1.2 })
            );
        }

        list.appendChild(div);
    });
}

/* ── NOTIFICATION TOAST ─────────────────────────────────────────────────── */
let _notifTimer = null;
function showNotification(msg) {
    const el = document.getElementById("notification");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(_notifTimer);
    _notifTimer = setTimeout(() => el.classList.remove("show"), 3500);
}

/* ── PANEL TOGGLE ────────────────────────────────────────────────────────── */
document.getElementById("toggle-panel").addEventListener("click", () => {
    panelOpen = !panelOpen;
    document.getElementById("side-panel").classList.toggle("open", panelOpen);
});

/* ── CENTER ON MY LOCATION ───────────────────────────────────────────────── */
document.getElementById("center-btn").addEventListener("click", () => {
    if (myLocation) {
        map.flyTo([myLocation.latitude, myLocation.longitude], 16, { duration: 0.9 });
    } else {
        showNotification("⚠ Your position not acquired yet");
    }
});

/* ── SOCKET EVENTS ───────────────────────────────────────────────────────── */

// Our own connection
socket.on("connect", () => {
    document.getElementById("status-text").textContent = "CONNECTED";
});

// Our own disconnection
socket.on("disconnect", () => {
    document.getElementById("status-text").textContent = "OFFLINE";
    showNotification("⚠ Connection lost — reconnecting…");
});

// ── FIX: Server sends us all current users right after we connect ─────────
// Without this, new users couldn't see anyone who was already on the map.
socket.on("existing-users", users => {
    Object.entries(users).forEach(([id, u]) => {
        if (id === socket.id) return; // skip ourselves
        userInfo[id] = u;
        if (u.latitude != null) placeOrUpdateMarker(id, u.name, u.latitude, u.longitude);
    });
    updateUserList();
    redrawLines();
});

// Someone new joined (we get this for ourselves too, but we skip creating a
// marker here — the marker is created when receive-location fires)
socket.on("user-joined", data => {
    if (!userInfo[data.id]) {
        userInfo[data.id] = { name: data.name, latitude: null, longitude: null };
    }
    updateUserList();
    if (data.id !== myId) showNotification(`📡 ${data.name} joined the network`);
});

// A user's GPS position has been updated
socket.on("receive-location", data => {
    const { id, name, latitude, longitude } = data;

    // ── FIX: update stored info regardless of who it is ──────────────────
    userInfo[id] = { name, latitude, longitude };

    // Place or update the marker on the map
    placeOrUpdateMarker(id, name, latitude, longitude);

    // Only centre the map the very first time WE get a location lock
    if (id === myId && !firstFix) {
        firstFix = true;
        map.setView([latitude, longitude], 16);
    }

    redrawLines();
    updateUserList();
});

// ── FIX: listen to "user-disconnect" not the raw "disconnect" event ───────
// The raw "disconnect" event is for OUR OWN socket and carries no user data.
socket.on("user-disconnect", data => {
    const { id, name } = data;

    if (markers[id]) {
        map.removeLayer(markers[id]);
        delete markers[id];
    }
    delete userInfo[id];

    redrawLines();
    updateUserList();
    showNotification(`📡 ${name || "A user"} left the network`);
});

/* ── UTILITY ─────────────────────────────────────────────────────────────── */
function esc(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}