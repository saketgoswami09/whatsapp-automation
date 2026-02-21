const mongoose = require('mongoose');
const logger = require('../utils/logger');

let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;

  const options = {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  };

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, options);
    isConnected = true;
    logger.info(`MongoDB connected: ${conn.connection.host}`);

    mongoose.connection.on('disconnected', () => {
      isConnected = false;
      logger.warn('MongoDB disconnected — attempting reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      isConnected = true;
      logger.info('MongoDB reconnected');
    });
  } catch (err) {
    logger.error(`MongoDB connection failed: ${err.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
