-- Migration: Add Images Tables
-- Date: 2025-12-08
-- Description: Adds tables for image upload and processing features

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
  operation_type VARCHAR(20) NOT NULL CHECK (operation_type IN ('crop', 'resize')),
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
COMMENT ON TABLE images IS 'Uploaded images metadata';
COMMENT ON TABLE image_operations IS 'Image processing operations (crop, resize)';

-- Verification query
SELECT 'Migration 002 completed successfully' AS status;
