const express = require("express");
const cpeak = require("cpeak");
const { authenticate, serverIndex } = require("./middleware/index.js");
const apiRouter = require("./router.js");
const path = require("path");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const cluster = require("node:cluster");

const PORT = 8060;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // In production, specify your actual frontend URL
    methods: ["GET", "POST"]
  }
});

app.use(cors())
// ------ Middlewares ------ //

// For serving static files
// app.use(cpeak.serveStatic(path.join(__dirname, "../public")));
app.use(express.static(path.join(__dirname, "../public")));

// For parsing JSON body
app.use(cpeak.parseJSON);

// For authentication
app.use(authenticate);

// For different routes that need the index.html file
app.use(serverIndex);

// ------ API Routes ------ //
apiRouter(app);

// Handle all the errors that could happen in the routes
app.use((error, req, res, next) => {
  if (error && error.status) {
    res.status(error.status).json({ error: error.message });
  } else {
    console.error(error);
    res.status(500).json({
      error: "Sorry, something unexpected happened from our side.",
    });
  }
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log(`[WebSocket] Client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`[WebSocket] Client disconnected: ${socket.id}`);
  });

  // Allow clients to subscribe to specific video updates
  socket.on('subscribe-video', (videoId) => {
    socket.join(`video:${videoId}`);
    console.log(`[WebSocket] Client ${socket.id} subscribed to video:${videoId}`);
  });

  socket.on('unsubscribe-video', (videoId) => {
    socket.leave(`video:${videoId}`);
    console.log(`[WebSocket] Client ${socket.id} unsubscribed from video:${videoId}`);
  });
});

// If running in cluster mode, listen for job events from primary process
if (cluster.isWorker) {
  process.on('message', (message) => {
    if (message.type === 'job-event') {
      const { event, data } = message;

      // Broadcast to all connected clients
      io.emit(event, data);

      // Also broadcast to video-specific room
      if (data.videoId) {
        io.to(`video:${data.videoId}`).emit(event, data);
      }
    }
  });
}

server.listen(PORT, () => {
  console.log(`Server has started on port ${PORT}`);
  if (cluster.isWorker) {
    console.log(`Worker ${cluster.worker.id} (PID: ${process.pid}) is ready`);
  }
});
