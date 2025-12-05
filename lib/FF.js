const { spawn } = require("node:child_process");

const makeThumbnail = (fullPath, thumbnailPath) => {
  // ffmpeg -i video.mp4 -ss 5 -vframes 1 thumbnail.jpg
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i",
      fullPath,
      "-ss",
      "5",
      "-vframes",
      "1",
      thumbnailPath,
    ]);

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(`FFmpeg existed with this code: ${code}`);
      }
    });

    ffmpeg.on("error", (err) => {
      reject(err);
    });
  });
};

const getDimensions = (fullPath) => {
  // ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 video.mp4
  return new Promise((resolve, reject) => {
    const ffprobe = spawn("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height",
      "-of",
      "csv=p=0",
      fullPath,
    ]);

    let dimensions = "";
    ffprobe.stdout.on("data", (data) => {
      dimensions += data.toString("utf8");
    });

    ffprobe.on("close", (code) => {
      if (code === 0) {
        dimensions = dimensions.replace(/\s/g, "").split(",");
        resolve({
          width: Number(dimensions[0]),
          height: Number(dimensions[1]),
        });
      } else {
        reject(`FFprobe existed with this code: ${code}`);
      }
    });

    ffprobe.on("error", (err) => {
      reject(err);
    });
  });
};

const extractAudio = (originalVideoPath, targetAudioPath) => {
  return new Promise((resolve, reject) => {
    // ffmpeg -i video.mp4 -vn -c:a copy audio.aac
    const ffmpeg = spawn("ffmpeg", [
      "-i",
      originalVideoPath,
      "-vn",
      "-c:a",
      "copy",
      targetAudioPath,
    ]);

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(`FFmpeg existed with this code: ${code}`);
      }
    });

    ffmpeg.on("error", (err) => {
      reject(err);
    });
  });
};

const resize = (originalVideoPath, targetVideoPath, width, height) => {
  return new Promise((resolve, reject) => {
    // ffmpeg -i video.mp4 -vf scale=320:240 -c:a copy video-320x240.mp4
    const ffmpeg = spawn("ffmpeg", [
      "-i",
      originalVideoPath,
      "-vf",
      `scale=${width}x${height}`,
      "-c:a",
      "copy",
      "-threads",
      "2",
      "-loglevel",
      "error",
      "-y",
      targetVideoPath,
    ]);

    ffmpeg.stderr.on("data", (data) => {
      console.log(data.toString("utf8"));
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(`FFmpeg existed with this code: ${code}`);
      }
    });

    ffmpeg.on("error", (err) => {
      reject(err);
    });
  });
};

const convertFormat = (originalVideoPath, targetVideoPath, targetFormat) => {
  return new Promise((resolve, reject) => {
    let videoCodec;
    let audioCodec;

    switch (targetFormat.toLowerCase()) {
      case "mp4":
      case "mov":
        videoCodec = "libx264";
        audioCodec = "aac";
        break;

      case "avi":
        // AVI does not work well with libx264
        videoCodec = "mpeg4";
        audioCodec = "libmp3lame";
        break;

      case "webm":
        videoCodec = "libvpx-vp9";
        audioCodec = "libopus";
        break;

      case "mkv":
        videoCodec = "libx264";
        audioCodec = "aac";
        break;

      default:
        videoCodec = "libx264";
        audioCodec = "aac";
    }

    const args = [
      "-y", // overwrite output
      "-i", originalVideoPath,
      "-c:v", videoCodec,
      "-c:a", audioCodec,
    ];

    // VP9 needs CRF mode
    if (targetFormat.toLowerCase() === "webm") {
      args.push("-b:v", "0", "-crf", "30");
    }

    // Set threads
    args.push("-threads", "2");

    // Error logging only
    args.push("-loglevel", "error");

    // Output path
    args.push(targetVideoPath);

    const ffmpeg = spawn("ffmpeg", args);

    ffmpeg.stderr.on("data", (data) => {
      console.log(data.toString("utf8"));
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(`FFmpeg exited with this code: ${code}`);
      }
    });

    ffmpeg.on("error", (err) => {
      reject(err);
    });
  });
};


/**
 * Add text watermark to a video
 * @param {string} originalVideoPath - Source video path
 * @param {string} targetVideoPath - Output video path
 * @param {string} text - Watermark text
 * @param {object} options - Watermark options (x, y, fontSize, fontColor, opacity)
 */
const watermarkVideo = (originalVideoPath, targetVideoPath, text, options = {}) => {
  return new Promise((resolve, reject) => {
    const {
      x = 10,
      y = 10,
      fontSize = 24,
      fontColor = 'white',
      opacity = 0.8
    } = options;

    // Escape special characters in text for FFmpeg
    const escapedText = text.replace(/'/g, "'\\''");

    // Build drawtext filter
    const drawtextFilter = `drawtext=text='${escapedText}':x=${x}:y=${y}:fontsize=${fontSize}:fontcolor=${fontColor}@${opacity}`;

    // ffmpeg -i input.mp4 -vf "drawtext=..." -codec:a copy output.mp4
    const ffmpeg = spawn("ffmpeg", [
      "-i",
      originalVideoPath,
      "-vf",
      drawtextFilter,
      "-codec:a",
      "copy",
 * Trim a video to specified start and end times
 * @param {string} originalVideoPath - Source video path
 * @param {string} targetVideoPath - Output video path
 * @param {number} startTime - Start time in seconds
 * @param {number} endTime - End time in seconds
 */
const trimVideo = (originalVideoPath, targetVideoPath, startTime, endTime) => {
  return new Promise((resolve, reject) => {
    const duration = endTime - startTime;

    if (duration <= 0) {
      reject(new Error('End time must be greater than start time'));
      return;
    }

    // ffmpeg -i input.mp4 -ss START_TIME -t DURATION -c copy output.mp4
    // Using -c copy for fast trimming without re-encoding
    const ffmpeg = spawn("ffmpeg", [
      "-i",
      originalVideoPath,
      "-ss",
      startTime.toString(),
      "-t",
      duration.toString(),
      "-c",
      "copy",
      "-loglevel",
      "error",
      "-y",
      targetVideoPath,
 * Crop an image to specified dimensions and position
 * @param {string} originalImagePath - Source image path
 * @param {string} targetImagePath - Output image path
 * @param {number} width - Crop width
 * @param {number} height - Crop height
 * @param {number} x - X coordinate (left edge)
 * @param {number} y - Y coordinate (top edge)
 */
const cropImage = (originalImagePath, targetImagePath, width, height, x = 0, y = 0) => {
  return new Promise((resolve, reject) => {
    // ffmpeg -i input.jpg -vf "crop=width:height:x:y" output.jpg
    const ffmpeg = spawn("ffmpeg", [
      "-i",
      originalImagePath,
      "-vf",
      `crop=${width}:${height}:${x}:${y}`,
      "-threads",
      "2",
      "-loglevel",
      "error",
      "-y",
      targetVideoPath,
      targetImagePath,
    ]);

    ffmpeg.stderr.on("data", (data) => {
      console.log(data.toString("utf8"));
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(`FFmpeg exited with this code: ${code}`);
      }
    });

    ffmpeg.on("error", (err) => {
      reject(err);
    });
  });
};

/**
 * Resize an image to specified dimensions
 * @param {string} originalImagePath - Source image path
 * @param {string} targetImagePath - Output image path
 * @param {number} width - Target width
 * @param {number} height - Target height
 */
const resizeImage = (originalImagePath, targetImagePath, width, height) => {
  return new Promise((resolve, reject) => {
    // ffmpeg -i image.jpg -vf scale=320:240 image-320x240.jpg
    const ffmpeg = spawn("ffmpeg", [
      "-i",
      originalImagePath,
      "-vf",
      `scale=${width}:${height}`,
      "-threads",
      "2",
      "-loglevel",
      "error",
      "-y",
      targetImagePath,
    ]);

    ffmpeg.stderr.on("data", (data) => {
      console.log(data.toString("utf8"));
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(`FFmpeg exited with this code: ${code}`);
      }
    });

    ffmpeg.on("error", (err) => {
      reject(err);
    });
  });
};

module.exports = {
  makeThumbnail,
  getDimensions,
  extractAudio,
  resize,
  convertFormat,
  watermarkVideo,
  trimVideo,
  cropImage,
  resizeImage,
};
