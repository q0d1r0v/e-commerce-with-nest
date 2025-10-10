import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import {
  createLogger,
  format,
  transports,
  Logger as WinstonLogger,
} from 'winston';
import type { Format } from 'logform';
import * as path from 'path';

interface LogInfo {
  level: string;
  message: string;
  timestamp?: string;
  context?: string;
  trace?: string;
  stack?: string;
  [key: string]: unknown;
}

@Injectable()
export class LoggerService implements NestLoggerService {
  private context?: string;
  private readonly logger: WinstonLogger;

  constructor() {
    const logFormat: Format = format.printf((info: unknown): string => {
      const logInfo = info as LogInfo;
      const timestamp = logInfo.timestamp ?? new Date().toISOString();
      const context = logInfo.context ? ` [${logInfo.context}]` : '';
      const level = logInfo.level.toUpperCase();
      const message = logInfo.message ?? '';
      const trace = logInfo.trace ? ` -> ${logInfo.trace}` : '';
      return `[${timestamp}] [${level}]${context}: ${message}${trace}`;
    });

    this.logger = createLogger({
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.errors({ stack: true }),
        format.splat(),
        logFormat,
      ),
      transports: [
        new transports.Console({
          format: format.combine(format.colorize({ all: true }), logFormat),
        }),
        new transports.File({
          filename: path.resolve('logs/app.log'),
          maxsize: 5 * 1024 * 1024,
          maxFiles: 5,
        }),
      ],
      exitOnError: false,
    });
  }

  setContext(context: string): void {
    this.context = context;
  }

  log(message: string): void {
    this.logger.info({ message, context: this.context });
  }

  error(message: string, trace?: string): void {
    this.logger.error({ message, trace, context: this.context });
  }

  warn(message: string): void {
    this.logger.warn({ message, context: this.context });
  }

  debug(message: string): void {
    this.logger.debug({ message, context: this.context });
  }

  verbose(message: string): void {
    this.logger.verbose({ message, context: this.context });
  }
}
