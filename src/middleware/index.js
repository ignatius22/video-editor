const sessionService = require("../../database/services/sessionService");
const path = require("path");

exports.authenticate = async (req, res, next) => {
  const routesToAuthenticate = [
    "GET /api/user",
    "PUT /api/user",
    "DELETE /api/logout",
    "POST /api/upload-video",
    "GET /api/videos",
    "GET /api/images",
    "POST /api/upload-image",
    "POST /api/image/crop",
    "POST /api/image/resize",
    "POST /api/image/convert",
    "GET /get-image-asset",
    "GET /get-video-asset",
  ];

  // Extract the pathname without query parameters
  const pathname = req.url.split('?')[0];
  const requestPath = req.method + " " + pathname;
  const isImageByIdRoute = req.method === "GET" && pathname.startsWith("/api/image/");

  if (routesToAuthenticate.indexOf(requestPath) !== -1 || isImageByIdRoute) {
    // If we have a token cookie, validate it
    if (req.headers.cookie) {
      const token = req.headers.cookie.split("=")[1];

      try {
        const user = await sessionService.validateToken(token);
        if (user) {
          req.userId = user.id;
          return next();
        }
      } catch (error) {
        console.error("Authentication error:", error);
      }
    }

    return res.status(401).json({ error: "Unauthorized" });
  } else {
    next();
  }
};

exports.serverIndex = (req, res, next) => {
  const routes = [
    "/",
    "/login",
    "/profile",
    "/operations",
    "/images",
    "/image-operations",
    "/analytics"
  ];

  // Also handle dynamic routes like /operations/:videoId and /image-operations/:imageId
  const isDynamicOperationsRoute = req.url.startsWith("/operations/");
  const isDynamicImageOperationsRoute = req.url.startsWith("/image-operations/");

  if (
    (routes.indexOf(req.url) !== -1 || isDynamicOperationsRoute || isDynamicImageOperationsRoute) &&
    req.method === "GET"
  ) {
    return res
      .status(200)
      .sendFile(path.join(__dirname, "../../public/index.html"), "text/html");
  } else {
    next();
  }
};
