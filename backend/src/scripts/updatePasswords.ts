import bcrypt from 'bcryptjs';
import { pool } from '../config/database';

async function updatePasswords() {
  try {
    // Hash passwords
    const rootPassword = await bcrypt.hash('Nikvtpass@2025', 10);
    const testPassword = await bcrypt.hash('123456', 10);

    console.log('Updating root password...');
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE email = $2',
      [rootPassword, 'nikileshm@vt.edu']
    );
    console.log('✓ Root password updated');

    console.log('Updating test account passwords...');
    const testEmails = [
      'Student1@gmail.com',
      'Student2@gmail.com',
      'Student3@gmail.com',
      'Student4@gmail.com',
      'Professor1@gmail.com'
    ];

    for (const email of testEmails) {
      await pool.query(
        'UPDATE users SET password_hash = $1 WHERE email = $2',
        [testPassword, email]
      );
      console.log(`✓ Updated password for ${email}`);
    }

    console.log('\n✅ All passwords updated successfully!');
    console.log('\nCredentials:');
    console.log('Root: nikileshm@vt.edu / Nikvtpass@2025');
    console.log('Test accounts: Student1-4@gmail.com, Professor1@gmail.com / 123456');

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

updatePasswords();
