// Logger utility for production error tracking
import config from '../config/env';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  data?: any;
  stack?: string;
  url?: string;
  userAgent?: string;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 100; // Keep last 100 logs in memory

  private createLogEntry(
    level: LogLevel,
    message: string,
    data?: any,
    error?: Error
  ): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      data,
      stack: error?.stack,
      url: window.location.href,
      userAgent: navigator.userAgent,
    };
  }

  private addLog(entry: LogEntry) {
    this.logs.push(entry);
    
    // Keep only last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // In production, send to logging service
    if (config.isProduction()) {
      this.sendToLoggingService(entry);
    }
  }

  private sendToLoggingService(entry: LogEntry) {
    // TODO: Integrate with logging service (e.g., Sentry, LogRocket, DataDog)
    // Example: Sentry.captureMessage(entry.message, { level: entry.level, extra: entry });
    
    // For now, just log to console in production
    if (entry.level === LogLevel.ERROR) {
      console.error('[Production Error]', entry);
    }
  }

  debug(message: string, data?: any) {
    const entry = this.createLogEntry(LogLevel.DEBUG, message, data);
    this.addLog(entry);
    
    if (config.isDevelopment()) {
      console.log(`[DEBUG] ${message}`, data || '');
    }
  }

  info(message: string, data?: any) {
    const entry = this.createLogEntry(LogLevel.INFO, message, data);
    this.addLog(entry);
    
    if (config.isDevelopment()) {
      console.info(`[INFO] ${message}`, data || '');
    }
  }

  warn(message: string, data?: any) {
    const entry = this.createLogEntry(LogLevel.WARN, message, data);
    this.addLog(entry);
    
    console.warn(`[WARN] ${message}`, data || '');
  }

  error(message: string, error?: Error, data?: any) {
    const entry = this.createLogEntry(LogLevel.ERROR, message, data, error);
    this.addLog(entry);
    
    console.error(`[ERROR] ${message}`, error || '', data || '');
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
  }

  // Export logs as JSON for debugging
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

// Create singleton instance
export const logger = new Logger();

// Global error handler
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    logger.error('Uncaught error', event.error, {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    logger.error('Unhandled promise rejection', event.reason, {
      promise: event.promise,
    });
  });
}

export default logger;
