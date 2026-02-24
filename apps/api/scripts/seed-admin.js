const { query, close } = require('@video-editor/database/db');
const bcrypt = require('bcrypt');

async function seed() {
  console.log('🌱 Starting admin data seeding...');

  try {
    const hashedPassword = await bcrypt.hash('password123', 10);

    // 1. Create sample users (last 60 days)
    const users = [
      ['admin_enterprise', 'enterprise@example.com', hashedPassword, 'pro', 5000, true],
      ['pro_user_1', 'pro1@example.com', hashedPassword, 'pro', 1200, false],
      ['pro_user_2', 'pro2@example.com', hashedPassword, 'pro', 850, false],
      ['free_user_1', 'free1@example.com', hashedPassword, 'free', 50, false],
      ['free_user_2', 'free2@example.com', hashedPassword, 'free', 10, false],
      ['free_user_3', 'free3@example.com', hashedPassword, 'free', 100, false],
      ['enterprise_client', 'corp@example.com', hashedPassword, 'pro', 10000, false],
      ['testuser', 'test@example.com', hashedPassword, 'pro', 1000, true],
    ];

    console.log('Seeding users...');
    const now = new Date();
    
    for (const u of users) {
      const daysAgo = Math.floor(Math.random() * 60);
      const createdAt = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
      
      await query(
        `INSERT INTO users (username, email, password_hash, tier, credits, is_admin, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         ON CONFLICT (username) DO UPDATE SET 
            tier = EXCLUDED.tier, 
            credits = users.credits + EXCLUDED.credits,
            is_admin = EXCLUDED.is_admin`,
        [...u, createdAt]
      );
    }

    // Get all user IDs for linking
    const userRes = await query('SELECT id FROM users');
    const userIds = userRes.rows.map(r => r.id);

    // 2. Clear transaction and job history to ensure clean charts
    console.log('Cleaning old history...');
    await query('TRUNCATE credit_transactions, job_history RESTART IDENTITY CASCADE');

    // 3. Create credit transactions (last 30 days)
    console.log('Creating 150 credit transactions...');
    const types = ['addition', 'deduction'];
    const descriptions = ['Purchased Credits', 'Video Processing', 'Image Processing', 'Subscription Bonus', 'Reward'];
    
    for (let i = 0; i < 150; i++) {
        const userId = userIds[Math.floor(Math.random() * userIds.length)];
        const type = types[Math.floor(Math.random() * types.length)];
        const amount = type === 'addition' ? Math.floor(Math.random() * 500) + 200 : Math.floor(Math.random() * 80) + 10;
        const description = descriptions[Math.floor(Math.random() * descriptions.length)];
        const daysAgo = Math.floor(Math.random() * 30);
        const date = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
        
        await query(
            'INSERT INTO credit_transactions (user_id, amount, type, description, created_at) VALUES ($1, $2, $3, $4, $5)',
            [userId, amount, type, description, date]
        );
    }

    // 4. Create job history (last 14 days)
    console.log('Creating 200 job history records...');
    const statuses = ['completed', 'completed', 'completed', 'completed', 'failed', 'completed', 'completed', 'completed']; // ~87% success
    const operations = ['resize', 'convert'];
    
    for (let i = 0; i < 200; i++) {
        const userId = userIds[Math.floor(Math.random() * userIds.length)];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const operation = operations[Math.floor(Math.random() * operations.length)];
        const duration = Math.floor(Math.random() * 8000) + 500;
        const daysAgo = Math.floor(Math.random() * 14);
        const date = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
        
        await query(
            'INSERT INTO job_history (job_id, status, type, user_id, created_at, duration) VALUES ($1, $2, $3, $4, $5, $6)',
            ['job_' + Math.random().toString(36).substr(2, 9), status, operation, userId, date, duration]
        );
    }

    // 5. Add some "active" jobs
    for (let i = 0; i < 5; i++) {
        const userId = userIds[Math.floor(Math.random() * userIds.length)];
        const operation = operations[Math.floor(Math.random() * operations.length)];
        await query(
            'INSERT INTO job_history (job_id, status, type, user_id, created_at, duration) VALUES ($1, $2, $3, $4, $5, $6)',
            ['job_active_' + i, 'active', operation, userId, new Date(), 0]
        );
    }

    console.log('✅ Seeding complete!');
    console.log('-----------------------------------');
    console.log('Log in with: admin_enterprise / password123');
    console.log('Or use existing: testuser / password123');
    console.log('-----------------------------------');

  } catch (err) {
    console.error('❌ Seeding failed:', err);
  } finally {
    await close();
  }
}

seed();
