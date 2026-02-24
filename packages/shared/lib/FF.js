const { spawn } = require("node:child_process");

// Track active processes for cleanup
const activeProcesses = new Set();

/**
 * Kill all active processes (useful for graceful shutdown)
 */
const cleanupProcesses = () => {
  for (const proc of activeProcesses) {
    try {
      proc.kill('SIGKILL');
    } catch (err) {}
  }
  activeProcesses.clear();
};

/**
 * Helper to run a command with a timeout
 */
const runCommand = (command, args, options = {}) => {
  const { 
    timeout = 300000, // Default 5 minutes
    onStdout,
    onStderr
  } = options;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args);
    activeProcesses.add(child);

    let isTimedOut = false;
    const timer = setTimeout(() => {
      isTimedOut = true;
      child.kill('SIGKILL'); // Force kill
      reject(new Error(`Process timed out after ${timeout}ms: ${command} ${args.join(' ')}`));
    }, timeout);

    child.stdout.on("data", (data) => {
      if (onStdout) onStdout(data);
    });

    child.stderr.on("data", (data) => {
      if (onStderr) onStderr(data);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      activeProcesses.delete(child);
      
      if (isTimedOut) return; // Promise already rejected

      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code: ${code}`));
      }
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      activeProcesses.delete(child);
      reject(err);
    });
  });
};

const makeThumbnail = (fullPath, thumbnailPath) => {
  // ffmpeg -i video.mp4 -ss 5 -vframes 1 -update 1 thumbnail.jpg
  return runCommand("ffmpeg", [
    "-i", fullPath,
    "-ss", "5",
    "-vframes", "1",
    "-update", "1",
    thumbnailPath,
  ], { timeout: 30000 }); // 30s timeout for thumbnail
};

const getDimensions = (fullPath) => {
  // ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 video.mp4
  let dimensions = "";
  return runCommand("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height",
    "-of", "csv=p=0",
    fullPath,
  ], { 
    timeout: 30000,
    onStdout: (data) => { dimensions += data.toString("utf8"); }
  }).then(() => {
    const parts = dimensions.replace(/\s/g, "").split(",");
    return {
      width: Number(parts[0]),
      height: Number(parts[1]),
    };
  });
};

const extractAudio = (originalVideoPath, targetAudioPath) => {
  return runCommand("ffmpeg", [
    "-i", originalVideoPath,
    "-vn",
    "-c:a", "copy",
    targetAudioPath,
  ]);
};

const resize = (originalVideoPath, targetVideoPath, width, height) => {
  return runCommand("ffmpeg", [
    "-i", originalVideoPath,
    "-vf", `scale=${width}x${height}`,
    "-c:a", "copy",
    "-threads", "2",
    "-loglevel", "error",
    "-y",
    targetVideoPath,
  ], {
    onStderr: (data) => { console.error(data.toString("utf8")); }
  });
};

const convertFormat = (originalVideoPath, targetVideoPath, targetFormat) => {
  let videoCodec;
  let audioCodec;

  switch (targetFormat.toLowerCase()) {
    case "mp4":
    case "mov":
      videoCodec = "libx264";
      audioCodec = "aac";
      break;

    case "avi":
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
    "-y",
    "-i", originalVideoPath,
    "-c:v", videoCodec,
    "-c:a", audioCodec,
  ];

  if (targetFormat.toLowerCase() === "webm") {
    args.push("-b:v", "0", "-crf", "30");
  }

  args.push("-threads", "2");
  args.push("-loglevel", "error");
  args.push(targetVideoPath);

  return runCommand("ffmpeg", args, {
    onStderr: (data) => { console.error(data.toString("utf8")); }
  });
};

const watermarkVideo = (originalVideoPath, targetVideoPath, text, options = {}) => {
  const {
    x = 10,
    y = 10,
    fontSize = 24,
    fontColor = 'white',
    opacity = 0.8
  } = options;

  const escapedText = text.replace(/'/g, "'\\''");
  const drawtextFilter = `drawtext=text='${escapedText}':x=${x}:y=${y}:fontsize=${fontSize}:fontcolor=${fontColor}@${opacity}`;

  return runCommand("ffmpeg", [
    "-i", originalVideoPath,
    "-vf", drawtextFilter,
    "-codec:a", "copy",
    "-threads", "2",
    "-loglevel", "error",
    "-y",
    targetVideoPath,
  ], {
    onStderr: (data) => { console.error(data.toString("utf8")); }
  });
};

const addImageWatermark = (originalVideoPath, watermarkImagePath, targetVideoPath, options = {}) => {
  const {
    position = 'top-right',
    opacity = 0.8
  } = options;

  let overlayFilter;
  switch (position) {
    case 'top-left': overlayFilter = `overlay=10:10`; break;
    case 'top-right': overlayFilter = `overlay=main_w-overlay_w-10:10`; break;
    case 'bottom-left': overlayFilter = `overlay=10:main_h-overlay_h-10`; break;
    case 'bottom-right': overlayFilter = `overlay=main_w-overlay_w-10:main_h-overlay_h-10`; break;
    default: overlayFilter = `overlay=main_w-overlay_w-10:10`;
  }

  const filterComplex = `[1:v]format=rgba,colorchannelmixer=aa=${opacity}[watermark];[0:v][watermark]${overlayFilter}`;

  return runCommand("ffmpeg", [
    "-i", originalVideoPath,
    "-i", watermarkImagePath,
    "-filter_complex", filterComplex,
    "-codec:a", "copy",
    "-threads", "2",
    "-loglevel", "error",
    "-y",
    targetVideoPath,
  ], {
    onStderr: (data) => { console.error(data.toString("utf8")); }
  });
};

const trimVideo = (originalVideoPath, targetVideoPath, startTime, endTime) => {
  const duration = endTime - startTime;

  if (duration <= 0) {
    return Promise.reject(new Error('End time must be greater than start time'));
  }

  return runCommand("ffmpeg", [
    "-i", originalVideoPath,
    "-ss", startTime.toString(),
    "-t", duration.toString(),
    "-c", "copy",
    "-loglevel", "error",
    "-y",
    targetVideoPath,
  ]);
};

const createGif = (originalVideoPath, targetGifPath, options = {}) => {
  const {
    fps = 10,
    width = 320,
    startTime,
    duration
  } = options;

  const args = ["-i", originalVideoPath];
  if (startTime !== undefined) args.push("-ss", startTime.toString());
  if (duration !== undefined) args.push("-t", duration.toString());

  args.push(
    "-vf", `fps=${fps},scale=${width}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`,
    "-loop", "0",
    "-loglevel", "error",
    "-y",
    targetGifPath
  );

  return runCommand("ffmpeg", args, {
    onStderr: (data) => { console.error(data.toString("utf8")); }
  });
};

const cropImage = (originalImagePath, targetImagePath, width, height, x = 0, y = 0) => {
  return runCommand("ffmpeg", [
    "-i", originalImagePath,
    "-vf", `crop=${width}:${height}:${x}:${y}`,
    "-threads", "2",
    "-loglevel", "error",
    "-y",
    targetImagePath,
  ], {
    timeout: 60000, // 1 minute for image crop
    onStderr: (data) => { console.error(data.toString("utf8")); }
  });
};

const resizeImage = (originalImagePath, targetImagePath, width, height) => {
  return runCommand("ffmpeg", [
    "-i", originalImagePath,
    "-vf", `scale=${width}:${height}`,
    "-threads", "2",
    "-loglevel", "error",
    "-y",
    targetImagePath,
  ], {
    timeout: 60000,
    onStderr: (data) => { console.error(data.toString("utf8")); }
  });
};

const convertImageFormat = (originalImagePath, targetImagePath, targetFormat) => {
  return runCommand("ffmpeg", [
    "-i", originalImagePath,
    "-loglevel", "error",
    "-y",
    targetImagePath,
  ], {
    timeout: 60000,
    onStderr: (data) => { console.error(data.toString("utf8")); }
  });
};

module.exports = {
  makeThumbnail,
  getDimensions,
  extractAudio,
  resize,
  convertFormat,
  watermarkVideo,
  addImageWatermark,
  trimVideo,
  createGif,
  cropImage,
  resizeImage,
  convertImageFormat,
  cleanupProcesses,
};
