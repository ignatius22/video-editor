// Controllers
const User = require("./controllers/user");
const Video = require("./controllers/video");
const Image = require("./controllers/image");

module.exports = (server) => {
  // ------------------------------------------------ //
  // ************ USER ROUTES ************* //
  // ------------------------------------------------ //

  // Log a user in and give them a token
  server.post("/api/login", User.logUserIn);

  // Log a user out
  server.delete("/api/logout", User.logUserOut);

  // Send user info
  server.get("/api/user", User.sendUserInfo);

  // Update a user info
  server.put("/api/user", User.updateUser);

  // ------------------------------------------------ //
  // ************ VIDEO ROUTES ************* //
  // ------------------------------------------------ //

  // Return the list of all the videos that a logged in user has uploaded
  server.get("/api/videos", Video.getVideos);

  // Upload a video file
  server.post("/api/upload-video", Video.uploadVideo);

  // Extract the audio for a video file (can only be done once per video)
  server.patch("/api/video/extract-audio", Video.extractAudio);

  // Resize a video file (creates a new video file)
  server.put("/api/video/resize", Video.resizeVideo);

  // Return a video asset to the client
  server.get("/get-video-asset", Video.getVideoAsset);


  // Convert video format (MP4, MOV, AVI, WebM, etc.)
  server.put("/api/video/convert", Video.convertVideoFormat);

  // ------------------------------------------------ //
  // ************ IMAGE ROUTES ************* //
  // ------------------------------------------------ //

  // Return the list of all images that a logged in user has uploaded
  server.get("/api/images", Image.getImages);

  // Upload an image file
  server.post("/api/upload-image", Image.uploadImage);

  // Crop an image (creates a new image file)
  server.post("/api/image/crop", Image.cropImage);

  // Resize an image (creates a new image file)
  server.post("/api/image/resize", Image.resizeImage);

  // Return an image asset to the client
  server.get("/get-image-asset", Image.getImageAsset);

  // Get image by ID (returns blob)
  server.get("/api/image/:imageId", Image.getImageById);
};
