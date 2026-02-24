/**
 * Create Test User Script
 * Creates a test user for telemetry testing
 */

const userService = require('./packages/shared/database/services/userService');

async function createTestUser() {
  try {
    console.log('Creating test user...');

    // Try to create test user
    const user = await userService.createUser({
      username: 'testuser',
      email: 'test@example.com',
      password: 'test123',
      tier: 'free'
    });

    console.log('✓ Test user created successfully!');
    console.log('  Username: testuser');
    console.log('  Password: test123');
    console.log('  Email: test@example.com');

    process.exit(0);
  } catch (error) {
    if (error.message?.includes('duplicate key')) {
      console.log('✓ Test user already exists');
      console.log('  Username: testuser');
      console.log('  Password: test123');
      process.exit(0);
    } else {
      console.error('✗ Failed to create test user:', error.message);
      process.exit(1);
    }
  }
}

createTestUser();
