/**
 * Automated Test Suite for AWS Elastic Beanstalk Node.js Application
 * Compatible with Node.js 18+ native test runner (used in AWS CodeBuild)
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { app } = require('../app');

let server;
let baseUrl;

before(async () => {
  return new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(async () => {
  return new Promise((resolve) => {
    server.close(resolve);
  });
});

// Helper for HTTP requests
function makeRequest(path, options = {}, bodyData = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: json
        });
      });
    });

    req.on('error', reject);

    if (bodyData) {
      req.write(typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData));
    }
    req.end();
  });
}

describe('AWS Week 4: Application Endpoints & Verification', () => {

  test('GET /health - ALB Health Check responds with 200 OK and healthy status', async () => {
    const res = await makeRequest('/health');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.status, 'healthy');
    assert.strictEqual(typeof res.data.uptimeSeconds, 'number');
    assert.strictEqual(typeof res.data.version, 'string');
    assert.strictEqual(typeof res.data.memoryUsageMB, 'number');
  });

  test('GET /api/info - Telemetry endpoint provides application and cloud metadata', async () => {
    const res = await makeRequest('/api/info');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.application);
    assert.ok(res.data.infrastructure);
    assert.ok(res.data.system);
    assert.strictEqual(res.data.application.author, 'Sakshi Bhalekar');
  });

  test('GET /api/tasks - Retrieves automated task logs', async () => {
    const res = await makeRequest('/api/tasks');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(Array.isArray(res.data.tasks));
    assert.ok(res.data.count >= 4);
  });

  test('POST /api/tasks - Logs a new deployment task record', async () => {
    const payload = {
      title: 'Route 53 DNS Switchover Validation',
      details: 'DualStack Alias A-record health check confirmed active.',
      status: 'COMPLETED'
    };

    const res = await makeRequest('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, payload);

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.task.title, payload.title);
    assert.strictEqual(res.data.task.status, 'COMPLETED');
  });

  test('POST /api/tasks - Rejects payload when title is missing', async () => {
    const res = await makeRequest('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { details: 'Missing title' });

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.data.success, false);
  });

  test('GET /api/stress - Simulates workload without crashing the server', async () => {
    const res = await makeRequest('/api/stress?duration=100');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.durationMs, 100);
  });

  test('GET / - Serves HTML Cloud Ops Dashboard', async () => {
    const res = await makeRequest('/');
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.headers['content-type'].includes('text/html'));
  });

});
