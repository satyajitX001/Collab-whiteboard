const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

// Serve static files from the client build directory
const path = require('path');
app.use(express.static(path.join(__dirname, '../client/out')));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for simplicity in this setup
        methods: ["GET", "POST"]
    }
});

const users = {}; // socket.id -> { roomId, userName }

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-room', ({ roomId, userName }) => {
        socket.join(roomId);
        users[socket.id] = { roomId, userName };

        console.log(`User ${userName} joined room ${roomId}`);

        // Broadcast to others in the room
        socket.to(roomId).emit('user-joined', userName);

        // Send updated user list to everyone in the room
        io.to(roomId).emit('update-users', getRoomUsers(roomId));
    });

    // Handle drawing events
    socket.on('draw', (data) => {
        const { roomId, ...drawOptions } = data;
        socket.to(roomId).emit('draw', drawOptions);
    });

    // Handle clear canvas
    socket.on('clear', (roomId) => {
        socket.to(roomId).emit('clear');
    });

    const handleLeave = () => {
        const user = users[socket.id];
        if (user) {
            const { roomId, userName } = user;
            socket.leave(roomId);
            delete users[socket.id];

            console.log(`User ${userName} left room ${roomId}`);
            io.to(roomId).emit('user-left', userName);
            io.to(roomId).emit('update-users', getRoomUsers(roomId));
        }
    };

    socket.on('leave-room', handleLeave);
    socket.on('disconnect', handleLeave);
});

// Handle React routing, return all requests to React app
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/out/index.html'));
});

function getRoomUsers(roomId) {
    return Object.values(users)
        .filter(user => user.roomId === roomId)
        .map(user => ({ userName: user.userName }));
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
