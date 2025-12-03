const fs = require("node:fs/promises");

const util = {};

// Delete a file if exits, if not the function will not throw an error
util.deleteFile = async (path) => {
  try {
    await fs.unlink(path);
  } catch (e) {
    // do nothing
  }
};

// Delete a folder if exits, if not the function will not throw an error
util.deleteFolder = async (path) => {
  try {
    await fs.rm(path, { recursive: true });
  } catch (e) {
    // do nothing
    console.log(e);
  }
};

// utils/mime.js
util.getMimeFromExtension = (ext) => {
  const map = {
    mp4: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
    avi: "video/x-msvideo",
    mkv: "video/x-matroska",
    m4v: "video/x-m4v",

    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",

    mp3: "audio/mpeg",
    aac: "audio/aac",
    wav: "audio/wav",
    ogg: "audio/ogg",
  };

  return map[ext.toLowerCase()] || "application/octet-stream";
};


module.exports = util;
