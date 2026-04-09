// Application health check utility
import config from '../config/env';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    name: string;
    status: 'pass' | 'fail' | 'warn';
    message: string;
    timestamp: string;
  }[];
  version: string;
  environment: string;
}

class HealthCheck {
  async checkLocalStorage(): Promise<{ status: 'pass' | 'fail'; message: string }> {
    try {
      const testKey = '__health_check__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return { status: 'pass', message: 'LocalStorage accessible' };
    } catch (error) {
      return { status: 'fail', message: 'LocalStorage not accessible' };
    }
  }

  async checkSessionStorage(): Promise<{ status: 'pass' | 'fail'; message: string }> {
    try {
      const testKey = '__health_check__';
      sessionStorage.setItem(testKey, 'test');
      sessionStorage.removeItem(testKey);
      return { status: 'pass', message: 'SessionStorage accessible' };
    } catch (error) {
      return { status: 'fail', message: 'SessionStorage not accessible' };
    }
  }

  async checkGeolocation(): Promise<{ status: 'pass' | 'fail' | 'warn'; message: string }> {
    if (!navigator.geolocation) {
      return { status: 'warn', message: 'Geolocation API not supported' };
    }
    
    try {
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve({ status: 'pass', message: 'Geolocation available' }),
          () => resolve({ status: 'warn', message: 'Geolocation permission denied' }),
          { timeout: 5000 }
        );
      });
    } catch (error) {
      return { status: 'warn', message: 'Geolocation error' };
    }
  }

  async checkAPIConnection(): Promise<{ status: 'pass' | 'fail' | 'warn'; message: string }> {
    try {
      // Simple connectivity check - in production, ping a health endpoint
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      // For mock mode, just return pass
      if (config.isDevelopment()) {
        clearTimeout(timeoutId);
        return { status: 'pass', message: 'API connection available (mock mode)' };
      }

      const response = await fetch(`${config.apiUrl}/health`, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        return { status: 'pass', message: 'API connection healthy' };
      } else {
        return { status: 'warn', message: `API returned status ${response.status}` };
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return { status: 'fail', message: 'API connection timeout' };
      }
      return { status: 'fail', message: 'API connection failed' };
    }
  }

  async checkBrowserCompatibility(): Promise<{ status: 'pass' | 'warn'; message: string }> {
    const features = {
      fetch: typeof fetch !== 'undefined',
      promise: typeof Promise !== 'undefined',
      localStorage: typeof localStorage !== 'undefined',
      geolocation: 'geolocation' in navigator,
      webSocket: 'WebSocket' in window,
    };

    const unsupported = Object.entries(features)
      .filter(([_, supported]) => !supported)
      .map(([feature]) => feature);

    if (unsupported.length === 0) {
      return { status: 'pass', message: 'Browser fully compatible' };
    } else {
      return {
        status: 'warn',
        message: `Missing features: ${unsupported.join(', ')}`,
      };
    }
  }

  async checkMemoryUsage(): Promise<{ status: 'pass' | 'warn'; message: string }> {
    // @ts-ignore - performance.memory is non-standard
    if (performance.memory) {
      // @ts-ignore
      const { usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit } = performance.memory;
      const usagePercent = (usedJSHeapSize / jsHeapSizeLimit) * 100;

      if (usagePercent > 90) {
        return { status: 'warn', message: `High memory usage: ${usagePercent.toFixed(1)}%` };
      }
      
      return { status: 'pass', message: `Memory usage: ${usagePercent.toFixed(1)}%` };
    }

    return { status: 'pass', message: 'Memory info not available' };
  }

  async performHealthCheck(): Promise<HealthCheckResult> {
    const timestamp = new Date().toISOString();

    const checks = await Promise.all([
      this.checkLocalStorage().then(result => ({
        name: 'LocalStorage',
        ...result,
        timestamp,
      })),
      this.checkSessionStorage().then(result => ({
        name: 'SessionStorage',
        ...result,
        timestamp,
      })),
      this.checkGeolocation().then(result => ({
        name: 'Geolocation',
        ...result,
        timestamp,
      })),
      this.checkAPIConnection().then(result => ({
        name: 'API Connection',
        ...result,
        timestamp,
      })),
      this.checkBrowserCompatibility().then(result => ({
        name: 'Browser Compatibility',
        ...result,
        timestamp,
      })),
      this.checkMemoryUsage().then(result => ({
        name: 'Memory Usage',
        ...result,
        timestamp,
      })),
    ]);

    const failCount = checks.filter(c => c.status === 'fail').length;
    const warnCount = checks.filter(c => c.status === 'warn').length;

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (failCount > 0) {
      overallStatus = 'unhealthy';
    } else if (warnCount > 2) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    return {
      status: overallStatus,
      checks,
      version: config.appVersion,
      environment: config.environment,
    };
  }

  // Quick check for critical features only
  async quickCheck(): Promise<boolean> {
    const localStorage = await this.checkLocalStorage();
    const browser = await this.checkBrowserCompatibility();
    
    return localStorage.status === 'pass' && browser.status === 'pass';
  }
}

export const healthCheck = new HealthCheck();

export default healthCheck;
