-- Video Editor Database Schema
-- PostgreSQL 12+

-- Create database (run this manually first)
-- CREATE DATABASE video_editor;

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  tier VARCHAR(20) DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days'),
  CONSTRAINT valid_session CHECK (expires_at > created_at)
);

-- Videos table
CREATE TABLE IF NOT EXISTS videos (
  id SERIAL PRIMARY KEY,
  video_id VARCHAR(50) UNIQUE NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  extension VARCHAR(10) NOT NULL CHECK (extension IN ('mp4', 'mov', 'avi', 'webm', 'mkv', 'flv')),
  dimensions JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Video operations table (resizes, conversions)
CREATE TABLE IF NOT EXISTS video_operations (
  id SERIAL PRIMARY KEY,
  video_id VARCHAR(50) NOT NULL REFERENCES videos(video_id) ON DELETE CASCADE,
  operation_type VARCHAR(20) NOT NULL CHECK (operation_type IN ('resize', 'convert', 'extract_audio')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  parameters JSONB NOT NULL,
  result_path VARCHAR(500),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Jobs history table (for Bull queue jobs)
CREATE TABLE IF NOT EXISTS job_history (
  id SERIAL PRIMARY KEY,
  job_id VARCHAR(100) UNIQUE NOT NULL,
  video_id VARCHAR(50) REFERENCES videos(video_id) ON DELETE SET NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('resize', 'convert')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('queued', 'active', 'completed', 'failed')),
  priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('high', 'normal', 'low')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  data JSONB,
  result JSONB,
  error TEXT,
  stack_trace TEXT,
  queued_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  failed_at TIMESTAMP,
  duration INTEGER, -- milliseconds
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_video_id ON videos(video_id);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_video_operations_video_id ON video_operations(video_id);
CREATE INDEX IF NOT EXISTS idx_video_operations_status ON video_operations(status);
CREATE INDEX IF NOT EXISTS idx_video_operations_created_at ON video_operations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_history_job_id ON job_history(job_id);
CREATE INDEX IF NOT EXISTS idx_job_history_video_id ON job_history(video_id);
CREATE INDEX IF NOT EXISTS idx_job_history_user_id ON job_history(user_id);
CREATE INDEX IF NOT EXISTS idx_job_history_status ON job_history(status);
CREATE INDEX IF NOT EXISTS idx_job_history_type ON job_history(type);
CREATE INDEX IF NOT EXISTS idx_job_history_created_at ON job_history(created_at DESC);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_videos_updated_at BEFORE UPDATE ON videos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_video_operations_updated_at BEFORE UPDATE ON video_operations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Function to get user statistics
CREATE OR REPLACE FUNCTION get_user_stats(p_user_id INTEGER)
RETURNS TABLE (
    total_videos BIGINT,
    total_jobs BIGINT,
    completed_jobs BIGINT,
    failed_jobs BIGINT,
    avg_job_duration NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(DISTINCT v.id)::BIGINT as total_videos,
        COUNT(jh.id)::BIGINT as total_jobs,
        COUNT(CASE WHEN jh.status = 'completed' THEN 1 END)::BIGINT as completed_jobs,
        COUNT(CASE WHEN jh.status = 'failed' THEN 1 END)::BIGINT as failed_jobs,
        AVG(jh.duration)::NUMERIC as avg_job_duration
    FROM users u
    LEFT JOIN videos v ON u.id = v.user_id
    LEFT JOIN job_history jh ON v.video_id = jh.video_id
    WHERE u.id = p_user_id
    GROUP BY u.id;
END;
$$ LANGUAGE plpgsql;

-- Sample data (optional - for testing)
-- INSERT INTO users (username, email, password_hash, tier) VALUES
-- ('john_doe', 'john@example.com', '$2b$10$...', 'free'),
-- ('jane_pro', 'jane@example.com', '$2b$10$...', 'pro');

-- Images table
CREATE TABLE IF NOT EXISTS images (
  id SERIAL PRIMARY KEY,
  image_id VARCHAR(50) UNIQUE NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  extension VARCHAR(10) NOT NULL CHECK (extension IN ('jpg', 'jpeg', 'png', 'webp', 'gif')),
  dimensions JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Image operations table (crops, resizes)
CREATE TABLE IF NOT EXISTS image_operations (
  id SERIAL PRIMARY KEY,
  image_id VARCHAR(50) NOT NULL REFERENCES images(image_id) ON DELETE CASCADE,
  operation_type VARCHAR(20) NOT NULL CHECK (operation_type IN ('crop', 'resize', 'convert-image')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  parameters JSONB NOT NULL,
  result_path VARCHAR(500),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for images
CREATE INDEX IF NOT EXISTS idx_images_user_id ON images(user_id);
CREATE INDEX IF NOT EXISTS idx_images_image_id ON images(image_id);
CREATE INDEX IF NOT EXISTS idx_images_created_at ON images(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_image_operations_image_id ON image_operations(image_id);
CREATE INDEX IF NOT EXISTS idx_image_operations_status ON image_operations(status);
CREATE INDEX IF NOT EXISTS idx_image_operations_created_at ON image_operations(created_at DESC);

-- Triggers for images
CREATE TRIGGER update_images_updated_at BEFORE UPDATE ON images
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_image_operations_updated_at BEFORE UPDATE ON image_operations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE users IS 'Application users with authentication';
COMMENT ON TABLE sessions IS 'User session tokens with expiration';
COMMENT ON TABLE videos IS 'Uploaded videos metadata';
COMMENT ON TABLE video_operations IS 'Video processing operations (resize, convert, etc.)';
COMMENT ON TABLE job_history IS 'Bull queue job history for analytics and monitoring';
COMMENT ON TABLE images IS 'Uploaded images metadata';
COMMENT ON TABLE image_operations IS 'Image processing operations (crop, resize)';
