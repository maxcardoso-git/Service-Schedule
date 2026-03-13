import winston from 'winston';

const { combine, timestamp, json, colorize, simple } = winston.format;

const isDev = process.env.NODE_ENV !== 'production';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(timestamp(), json()),
  transports: [
    new winston.transports.Console({
      format: isDev ? combine(colorize(), simple()) : combine(timestamp(), json()),
    }),
  ],
});

export default logger;
