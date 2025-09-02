import { Sequelize } from 'sequelize';
import { logger } from '../utils/logger.js';

let sequelize;

export const initializeDatabase = async () => {
  try {
    // Database configuration
    const config = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'ai_policy_foundry',
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      dialect: 'postgres',
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
      pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    };

    // Create Sequelize instance
    sequelize = new Sequelize(config);

    // Test connection
    await sequelize.authenticate();
    logger.info('Database connection established successfully');

    // Sync models (in development)
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      logger.info('Database models synchronized');
    }

    return sequelize;

  } catch (error) {
    logger.error('Failed to initialize database:', error);
    throw error;
  }
};

export const getDatabase = () => {
  if (!sequelize) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return sequelize;
};

export const closeDatabase = async () => {
  if (sequelize) {
    await sequelize.close();
    logger.info('Database connection closed');
  }
}; 