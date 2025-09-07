#!/usr/bin/env tsx

/**
 * Database Setup Script
 * 
 * This script sets up the database schema and creates an initial admin user.
 * Run this after setting up your environment variables.
 * 
 * Usage:
 *   npm run db:setup
 *   or
 *   tsx scripts/setup-database.ts
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import readline from 'readline';

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function setupDatabase() {
  console.log('🚀 Setting up MeetBotAI Database...\n');

  try {
    // Test database connection
    console.log('📡 Testing database connection...');
    await prisma.$connect();
    console.log('✅ Database connection successful\n');

    // Check if admin user already exists
    const existingAdmin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
    });

    if (existingAdmin) {
      console.log('⚠️  Admin user already exists:');
      console.log(`   Email: ${existingAdmin.email}`);
      console.log(`   Name: ${existingAdmin.name || 'Not set'}`);
      console.log(`   Created: ${existingAdmin.createdAt.toLocaleDateString()}\n`);
      
      const shouldContinue = await ask('Do you want to create another admin user? (y/N): ');
      if (shouldContinue.toLowerCase() !== 'y') {
        console.log('✅ Setup completed - using existing admin user');
        return;
      }
    }

    // Create admin user
    console.log('👤 Creating admin user...\n');
    
    const email = await ask('Admin email: ');
    if (!email || !email.includes('@')) {
      throw new Error('Valid email is required');
    }

    // Check if user with this email already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new Error(`User with email ${email} already exists`);
    }

    const name = await ask('Admin name: ');
    if (!name) {
      throw new Error('Name is required');
    }

    const password = await ask('Admin password (min 8 characters): ');
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    const companyName = await ask('Company name (optional): ');

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        email,
        name,
        companyName: companyName || null,
        passwordHash,
        role: 'ADMIN',
        provider: 'email',
        isActive: true,
      },
    });

    console.log('\n✅ Admin user created successfully!');
    console.log(`   ID: ${adminUser.id}`);
    console.log(`   Email: ${adminUser.email}`);
    console.log(`   Name: ${adminUser.name}`);
    console.log(`   Role: ${adminUser.role}\n`);

    // Create a sample API token for the admin
    const tokenLabel = 'Initial Admin Token';
    const tokenPrefix = 'mbt_';
    const tokenBody = require('crypto').randomBytes(32).toString('hex');
    const apiToken = `${tokenPrefix}${tokenBody}`;
    const tokenHash = await bcrypt.hash(apiToken, 12);

    const adminToken = await prisma.apiToken.create({
      data: {
        userId: adminUser.id,
        token: tokenHash,
        label: tokenLabel,
        status: 'active',
      },
    });

    console.log('🔑 Sample API token created:');
    console.log(`   Token: ${apiToken}`);
    console.log(`   Label: ${tokenLabel}`);
    console.log('   ⚠️  Save this token - you won\'t see it again!\n');

    // Display next steps
    console.log('🎉 Database setup completed!\n');
    console.log('📝 Next steps:');
    console.log('   1. Start the backend server: npm run dev');
    console.log('   2. Start the frontend: cd ../frontend && npm run dev');
    console.log('   3. Login with your admin credentials');
    console.log('   4. Explore the admin dashboard\n');

    console.log('🔗 Important URLs:');
    console.log('   Frontend: http://localhost:3000');
    console.log('   Backend API: http://localhost:5000');
    console.log('   Admin Dashboard: http://localhost:3000/admin\n');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    rl.close();
  }
}

// Run the setup
if (require.main === module) {
  setupDatabase().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { setupDatabase };
