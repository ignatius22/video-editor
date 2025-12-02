# Video Editor Express

A web-based video editing application built with Node.js and Express that allows users to upload, manage, and perform basic editing operations on video files.

## Features

- **User Authentication**: Login/logout system with token-based authentication
- **Video Upload**: Upload video files to the server
- **Video Management**: View and manage all uploaded videos
- **Audio Extraction**: Extract audio tracks from video files
- **Video Resizing**: Resize videos to different dimensions
- **Thumbnail Generation**: Automatic thumbnail creation for uploaded videos
- **Clustering Support**: Run the application in cluster mode for better performance

## Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v12 or higher)
- [FFmpeg](https://ffmpeg.org/download.html) - Required for video processing operations
- [FFprobe](https://ffmpeg.org/ffprobe.html) - Usually comes with FFmpeg installation

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd video-editor-express
```

2. Install dependencies:
```bash
npm install
```

3. Create the required directories:
```bash
mkdir -p public storage data
```

These directories are essential for the application:
- `public/` - Static files (HTML, CSS, JavaScript)
- `storage/` - Uploaded video files and processed media
- `data/` - Application data and database files

## Configuration

The server runs on port `8060` by default. You can modify this in [src/index.js](src/index.js).

## Running the Application

### Standard Mode

Start the server with auto-reload on file changes:
```bash
npm start
```

### Cluster Mode

Run the application in cluster mode for improved performance:
```bash
npm run cluster
```

The server will start at `http://localhost:8060`

## Project Structure

```
video-editor-express/
├── lib/
│   ├── FF.js           # FFmpeg wrapper functions
│   ├── JobQueue.js     # Job queue for video processing
│   └── util.js         # Utility functions
├── src/
│   ├── controllers/
│   │   ├── user.js     # User-related endpoints
│   │   └── video.js    # Video-related endpoints
│   ├── middleware/
│   │   └── index.js    # Authentication & other middleware
│   ├── cluster.js      # Cluster mode entry point
│   ├── DB.js           # Database operations
│   ├── index.js        # Main server entry point
│   └── router.js       # API route definitions
├── public/             # Frontend static files
│   ├── index.html
│   ├── scripts.js
│   └── styles.css
├── storage/            # Video file storage (create manually)
├── data/               # Application data (create manually)
└── package.json
```

## API Endpoints

### User Routes

- `POST /api/login` - Log in a user and receive an authentication token
- `DELETE /api/logout` - Log out the current user
- `GET /api/user` - Get current user information
- `PUT /api/user` - Update user information

### Video Routes

- `GET /api/videos` - Get all videos uploaded by the logged-in user
- `POST /api/upload-video` - Upload a new video file
- `PATCH /api/video/extract-audio` - Extract audio from a video
- `PUT /api/video/resize` - Resize a video to new dimensions
- `GET /get-video-asset` - Retrieve a video asset

## Dependencies

- **express** (^4.18.2) - Web framework
- **cpeak** (^1.4.0) - Custom utilities for Express applications

## Development

The project uses `nodemon` for automatic server reloading during development. The server ignores changes in the `./public` directory to prevent unnecessary reloads.

## Error Handling

The application includes centralized error handling middleware that catches and returns appropriate error responses to the client.

## Technologies Used

- **Backend**: Node.js, Express.js
- **Video Processing**: FFmpeg, FFprobe
- **Frontend**: Vanilla JavaScript, HTML, CSS

## License

ISC

## Author

Ignatius Sani
