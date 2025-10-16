import bcrypt from 'bcryptjs';
import { pool } from '../config/database';

const resetRootPassword = async () => {
  const client = await pool.connect();

  try {
    const newPassword = 'Nikvtpass@2025';
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    const result = await client.query(
      'UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING id, email',
      [passwordHash, 'nikileshm@vt.edu']
    );

    if (result.rows.length > 0) {
      console.log('✓ Root password updated successfully!');
      console.log('Email:', result.rows[0].email);
      console.log('New password:', newPassword);
    } else {
      console.log('✗ Root user not found');
    }
  } catch (error) {
    console.error('Error resetting password:', error);
  } finally {
    client.release();
    process.exit(0);
  }
};

resetRootPassword();
