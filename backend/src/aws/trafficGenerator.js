/**
 * trafficGenerator.js — Real HTTP Traffic Generator
 *
 * Fires real HTTP GET requests to an ALB endpoint at a configurable RPS.
 * Tracks per-request stats and aggregates them for the dashboard.
 */
import http from 'http';

class TrafficGenerator {
  constructor() {
    this._interval = null;
    this._rps = 5;
    this._target = null; // { hostname, port, path }

    // Live stats
    this.stats = {
      totalRequests: 0,
      totalSucceeded: 0,
      totalFailed: 0,
      responseTimes: [], // last N entries
      rpsHistory: [],    // [{time, rps}], max 60
      serverCounts: {},  // Tracking requests routed to each EC2 instance (Lifetime)
      recentTargets: [], // Tracking last 100 requests for live load distribution calculation
    };

    this._windowRequests = 0;
    this._windowStart = Date.now();
  }

  /**
   * Start firing requests
   * @param {string} albDns - ALB DNS name (no protocol)
   * @param {number} rps    - Requests per second (1–50)
   */
  start(albDns, rps = 5) {
    if (this._interval) this.stop();

    this._rps = Math.max(1, Math.min(50, rps));
    this._target = { hostname: albDns, port: 80, path: '/' };
    this._windowStart = Date.now();
    this._windowRequests = 0;

    // Fire `rps` requests every second
    this._interval = setInterval(async () => {
      const bucket = [];
      for (let i = 0; i < this._rps; i++) {
        bucket.push(this._sendRequest());
      }
      await Promise.allSettled(bucket);

      // RPS history
      const elapsed = (Date.now() - this._windowStart) / 1000 || 1;
      const measuredRps = Math.round(this._windowRequests / elapsed);
      this.stats.rpsHistory.push({ time: Date.now(), rps: this._rps });
      if (this.stats.rpsHistory.length > 60) this.stats.rpsHistory.shift();
      this._windowRequests = 0;
      this._windowStart = Date.now();
    }, 1000);

    console.log(`🚦 Traffic generator: ${this._rps} RPS → http://${albDns}`);
  }

  /** Stop generating traffic */
  stop() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }

  /** Update RPS on the fly */
  setRps(rps) {
    this._rps = Math.max(1, Math.min(50, rps));
    if (this._interval) {
      // Restart with new rate
      const target = this._target;
      this.stop();
      if (target) this.start(target.hostname, this._rps);
    }
  }

  /** True if actively generating */
  get isRunning() {
    return this._interval !== null;
  }

  /** Send a single HTTP request and record outcome */
  _sendRequest() {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const target = this._target;
      if (!target) return resolve();

      this.stats.totalRequests++;
      this._windowRequests++;

      const req = http.get(
        {
          hostname: target.hostname,
          port: target.port,
          path: target.path,
          timeout: 10000,
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => body += chunk);
          res.on('end', () => {
            const rt = Date.now() - startTime;
            this.stats.totalSucceeded++;
            this._recordResponseTime(rt);
            try {
              const data = JSON.parse(body);
              if (data.server) {
                this.stats.serverCounts[data.server] = (this.stats.serverCounts[data.server] || 0) + 1;
                this.stats.recentTargets.push(data.server);
                if (this.stats.recentTargets.length > 200) this.stats.recentTargets.shift();
              }
            } catch (e) { /* ignore parse errors */ }
            resolve({ success: true, statusCode: res.statusCode, responseTime: rt });
          });
        }
      );

      req.on('error', (err) => {
        this.stats.totalFailed++;
        resolve({ success: false, error: err.message });
      });

      req.on('timeout', () => {
        req.destroy();
        this.stats.totalFailed++;
        resolve({ success: false, error: 'timeout' });
      });
    });
  }

  /** Keep rolling window of last 100 response times */
  _recordResponseTime(ms) {
    this.stats.responseTimes.push(ms);
    if (this.stats.responseTimes.length > 100) this.stats.responseTimes.shift();
  }

  /** Get aggregated stats for the dashboard */
  getStats() {
    const rts = this.stats.responseTimes;
    const avgRt = rts.length
      ? Math.round(rts.reduce((a, b) => a + b, 0) / rts.length)
      : 0;
    const maxRt = rts.length ? Math.max(...rts) : 0;

    return {
      isRunning: this.isRunning,
      totalRequests: this.stats.totalRequests,
      totalSucceeded: this.stats.totalSucceeded,
      totalFailed: this.stats.totalFailed,
      errorRate: this.stats.totalRequests
        ? Math.round((this.stats.totalFailed / this.stats.totalRequests) * 100)
        : 0,
      avgResponseTimeMs: avgRt,
      maxResponseTimeMs: maxRt,
      rpsHistory: this.stats.rpsHistory.slice(-30),
      currentRps: this._rps,
      serverCounts: this.stats.serverCounts,
      recentTargets: this.stats.recentTargets,
    };
  }

  /** Reset all stats */
  reset() {
    this.stop();
    this.stats = {
      totalRequests: 0,
      totalSucceeded: 0,
      totalFailed: 0,
      responseTimes: [],
      rpsHistory: [],
      serverCounts: {},
      recentTargets: [],
    };
    this._windowRequests = 0;
    this._windowStart = Date.now();
  }
}

// Singleton
export const trafficGenerator = new TrafficGenerator();
