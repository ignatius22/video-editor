/**
 * Seed Data Script
 * Populates the database with initial test data
 */

const userService = require('../packages/shared/database/services/userService');
const videoService = require('../packages/shared/database/services/videoService');
const imageService = require('../packages/shared/database/services/imageService');
const jobHistoryService = require('../packages/shared/database/services/jobHistoryService');
const { v4: uuidv4 } = require('uuid');

async function seedData() {
  try {
    console.log('--- Starting Data Seeding ---');

    // 1. Create Users
    console.log('Creating users...');
    const users = [
      { username: 'admin', email: 'admin@convertix.io', password: 'adminpassword', tier: 'pro', is_admin: true },
      { username: 'pro_user', email: 'pro@example.com', password: 'propassword', tier: 'pro' },
      { username: 'free_user', email: 'free@example.com', password: 'freepassword', tier: 'free' }
    ];

    const createdUsers = [];
    for (const userData of users) {
      try {
        let user = await userService.findByUsername(userData.username);
        if (!user) {
          user = await userService.createUser(userData);
          if (userData.is_admin) {
             await userService.updateUser(user.id, { is_admin: true });
          }
          console.log(`✓ User ${userData.username} created`);
        } else {
          console.log(`- User ${userData.username} already exists`);
        }
        createdUsers.push(user);
      } catch (err) {
        console.error(`✗ Failed to create user ${userData.username}:`, err.message);
      }
    }

    // 2. Create Videos for each user
    console.log('\nCreating videos...');
    for (const user of createdUsers) {
      const videoId = uuidv4();
      const video = await videoService.createVideo({
        videoId,
        userId: user.id,
        name: `Sample Video for ${user.username}`,
        extension: 'mp4',
        dimensions: { width: 1920, height: 1080 },
        metadata: { duration: 60, size: 5000000 }
      });
      console.log(`✓ Video created for ${user.username}: ${video.name}`);

      // Add some operations for each video
      const op1 = await videoService.addOperation(videoId, {
        type: 'resize',
        status: 'completed',
        parameters: { width: 1280, height: 720 },
        resultPath: `/storage/videos/${videoId}/resize_720p.mp4`
      });

      await jobHistoryService.createJob({
        jobId: `job_${op1.id}`,
        videoId,
        userId: user.id,
        type: 'resize',
        status: 'completed',
        data: { parameters: op1.parameters }
      });

      const op2 = await videoService.addOperation(videoId, {
        type: 'convert',
        status: 'pending',
        parameters: { targetFormat: 'webm' }
      });

      await jobHistoryService.createJob({
        jobId: `job_${op2.id}`,
        videoId,
        userId: user.id,
        type: 'convert',
        status: 'queued',
        data: { parameters: op2.parameters }
      });
    }

    // 3. Create Images for each user
    console.log('\nCreating images...');
    for (const user of createdUsers) {
      const imageId = uuidv4();
      const image = await imageService.createImage({
        imageId,
        userId: user.id,
        name: `Sample Image for ${user.username}`,
        extension: 'jpg',
        dimensions: { width: 800, height: 600 },
        metadata: { size: 200000 }
      });
      console.log(`✓ Image created for ${user.username}: ${image.name}`);

      // Add some operations for each image
      await imageService.addOperation(imageId, {
        type: 'crop',
        status: 'completed',
        parameters: { width: 400, height: 400, x: 0, y: 0 },
        resultPath: `/storage/images/${imageId}/crop_square.jpg`
      });
    }

    console.log('\n--- Seeding Completed Successfully ---');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Seeding failed:', error);
    process.exit(1);
  }
}

seedData();
