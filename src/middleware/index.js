const sessionService = require("../../database/services/sessionService");
const path = require("path");

exports.authenticate = async (req, res, next) => {
  const routesToAuthenticate = [
    "GET /api/user",
    "PUT /api/user",
    "DELETE /api/logout",
    "POST /api/upload-video",
    "GET /api/videos",
  ];

  if (routesToAuthenticate.indexOf(req.method + " " + req.url) !== -1) {
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
  const routes = ["/", "/login", "/profile"];

  if (routes.indexOf(req.url) !== -1 && req.method === "GET") {
    return res
      .status(200)
      .sendFile(path.join(__dirname, "../../public/index.html"), "text/html");
  } else {
    next();
  }
};
