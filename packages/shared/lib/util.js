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

/**
 * Validate file content against claimed extension using magic numbers.
 * @param {Buffer} buffer - First few bytes of the file (at least 12 bytes recommended)
 * @param {string} extension - Claimed file extension
 * @returns {boolean} True if magic numbers match extension
 */
util.validateMagicNumbers = (buffer, extension) => {
  if (!buffer || buffer.length < 4) return false;
  
  const ext = extension.toLowerCase();
  const hex = buffer.toString('hex').toUpperCase();

  // Image Signatures
  if (ext === 'png' && hex.startsWith('89504E47')) return true;
  if ((ext === 'jpg' || ext === 'jpeg') && hex.startsWith('FFD8FF')) return true;
  if (ext === 'gif' && hex.startsWith('47494638')) return true;
  if (ext === 'webp' && hex.startsWith('52494646') && hex.slice(16, 24) === '57454250') return true;

  // Video Signatures (ISO Base Media File Format usually starts with ftyp at offset 4)
  // hex.slice(8, 16) is the ftyp identifier
  if (ext === 'mp4' || ext === 'mov') {
    const ftyp = hex.slice(8, 16);
    if (ftyp === '66747970') return true; // 'ftyp'
  }

  return false;
};


module.exports = util;
