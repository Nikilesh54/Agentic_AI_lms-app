"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedRootUser = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const database_1 = require("./database");
const seedRootUser = async () => {
    const client = await database_1.pool.connect();
    try {
        // Check if root user already exists
        const existingRoot = await client.query('SELECT id FROM users WHERE email = $1', ['nikileshm@vt.edu']);
        if (existingRoot.rows.length > 0) {
            console.log('Root user already exists');
            return;
        }
        // Hash the default password from environment variable
        const saltRounds = 10;
        const defaultPassword = process.env.SEED_DEFAULT_PASSWORD;
        if (!defaultPassword) {
            throw new Error('SEED_DEFAULT_PASSWORD environment variable must be set to seed the database');
        }
        const passwordHash = await bcryptjs_1.default.hash(defaultPassword, saltRounds);
        // Insert root user
        const result = await client.query(`INSERT INTO users (full_name, email, password_hash, role, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, full_name, email, role, status`, ['Root Administrator', 'nikileshm@vt.edu', passwordHash, 'root', 'active']);
        console.log('Root user created successfully:', {
            id: result.rows[0].id,
            fullName: result.rows[0].full_name,
            email: result.rows[0].email,
            role: result.rows[0].role,
            status: result.rows[0].status
        });
        console.log('Default password: [Set via SEED_DEFAULT_PASSWORD env var]');
        console.log('IMPORTANT: Please change this password after first login!');
    }
    catch (error) {
        console.error('Error seeding root user:', error);
        throw error;
    }
    finally {
        client.release();
    }
};
exports.seedRootUser = seedRootUser;
//# sourceMappingURL=seed.js.map