/**
 * AWS Cloud Foundations (Week 4): Deployment & Automation
 * Author: Sakshi Bhalekar
 * Purpose: Production-grade Node.js/Express application for AWS Elastic Beanstalk
 * Features: Live Cloud Ops Dashboard, IMDSv2 Metadata, /health endpoint for ALB,
 *           REST APIs, and simulated workload for Auto Scaling verification.
 */

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const os = require('os');
const http = require('http');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;
const NODE_ENV = process.env.NODE_ENV || 'production';
const APP_VERSION = process.env.APP_VERSION || '1.0.0';
const startTime = Date.now();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));
app.use(express.static(path.join(__dirname, 'public')));

// In-memory deployment / task audit records
let taskRecords = [
  {
    id: 1,
    title: 'Elastic Beanstalk Provisioning',
    status: 'COMPLETED',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    details: 'Node.js 20 on 64bit Amazon Linux 2023 environment initialized with Application Load Balancer.'
  },
  {
    id: 2,
    title: 'CloudFormation Stack Orchestration',
    status: 'COMPLETED',
    timestamp: new Date(Date.now() - 2400000).toISOString(),
    details: 'Automated IAM roles, instance profiles, Route 53 zones, and Beanstalk templates.'
  },
  {
    id: 3,
    title: 'Route 53 DNS Record Association',
    status: 'COMPLETED',
    timestamp: new Date(Date.now() - 1200000).toISOString(),
    details: 'Configured DualStack Alias A-record with zero latency routing and health checks.'
  },
  {
    id: 4,
    title: 'CodePipeline CI/CD Automation',
    status: 'COMPLETED',
    timestamp: new Date(Date.now() - 600000).toISOString(),
    details: '3-stage pipeline active (Source -> CodeBuild unit tests -> Elastic Beanstalk zero-downtime deployment).'
  }
];

// Helper: Fetch AWS EC2 IMDSv2 metadata with fallback for local development
async function getAwsMetadata() {
  const metadata = {
    instanceId: 'i-local-dev',
    availabilityZone: 'local-az',
    privateIp: getLocalIpAddress(),
    publicIp: '127.0.0.1',
    instanceType: 'local-workstation',
    region: process.env.AWS_REGION || 'us-east-1',
    isAwsEc2: false
  };

  const fetchWithTimeout = (url, options = {}, timeoutMs = 800) => {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const req = http.request(parsedUrl, { ...options, timeout: timeoutMs }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data.trim());
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout'));
      });
      req.end();
    });
  };

  try {
    // Attempt IMDSv2 token retrieval
    const token = await fetchWithTimeout('http://169.254.169.254/latest/api/token', {
      method: 'PUT',
      headers: { 'X-aws-ec2-metadata-token-ttl-seconds': '60' }
    }, 700);

    const headers = { 'X-aws-ec2-metadata-token': token };

    const [instanceId, az, privateIp, instanceType] = await Promise.allSettled([
      fetchWithTimeout('http://169.254.169.254/latest/meta-data/instance-id', { headers }),
      fetchWithTimeout('http://169.254.169.254/latest/meta-data/placement/availability-zone', { headers }),
      fetchWithTimeout('http://169.254.169.254/latest/meta-data/local-ipv4', { headers }),
      fetchWithTimeout('http://169.254.169.254/latest/meta-data/instance-type', { headers })
    ]);

    if (instanceId.status === 'fulfilled') metadata.instanceId = instanceId.value;
    if (az.status === 'fulfilled') {
      metadata.availabilityZone = az.value;
      metadata.region = az.value.slice(0, -1);
    }
    if (privateIp.status === 'fulfilled') metadata.privateIp = privateIp.value;
    if (instanceType.status === 'fulfilled') metadata.instanceType = instanceType.value;
    metadata.isAwsEc2 = true;
  } catch (err) {
    // Running outside EC2 or IMDS not reachable
  }

  return metadata;
}

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

// -------------------------------------------------------------
// ROUTES & API ENDPOINTS
// -------------------------------------------------------------

/**
 * @route   GET /health
 * @desc    Critical health check endpoint used by AWS Elastic Beanstalk ALB & Route 53
 */
app.get('/health', (req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  res.status(200).json({
    status: 'healthy',
    uptimeSeconds,
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    version: APP_VERSION,
    service: 'AWS-Elastic-Beanstalk-NodeApp',
    memoryUsageMB: Math.round(process.memoryUsage().rss / (1024 * 1024)),
    hostname: os.hostname()
  });
});

/**
 * @route   GET /api/info
 * @desc    Detailed runtime, infrastructure, and EC2 IMDSv2 metadata
 */
app.get('/api/info', async (req, res) => {
  try {
    const awsMeta = await getAwsMetadata();
    res.json({
      success: true,
      application: {
        name: 'Week 4 - Deployment & Automation',
        author: 'Sakshi Bhalekar',
        version: APP_VERSION,
        environment: NODE_ENV,
        nodeVersion: process.version,
        uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
        startedAt: new Date(startTime).toISOString()
      },
      infrastructure: {
        platform: 'AWS Elastic Beanstalk (Amazon Linux 2023)',
        cloudFormationStack: process.env.CFN_STACK_NAME || 'week4-eb-stack',
        codePipelineStage: process.env.PIPELINE_STAGE || 'Production-Deploy',
        route53Domain: process.env.APP_DOMAIN || 'api.cloud-week4.internal',
        awsMetadata: awsMeta
      },
      system: {
        platform: os.platform(),
        release: os.release(),
        arch: os.arch(),
        hostname: os.hostname(),
        cpus: os.cpus().length,
        freeMemoryMB: Math.round(os.freemem() / (1024 * 1024)),
        totalMemoryMB: Math.round(os.totalmem() / (1024 * 1024)),
        loadAverage: os.loadavg()
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/tasks
 * @desc    Fetch automated infrastructure records and tasks
 */
app.get('/api/tasks', (req, res) => {
  res.json({
    success: true,
    count: taskRecords.length,
    tasks: taskRecords
  });
});

/**
 * @route   POST /api/tasks
 * @desc    Log a new task / automated action
 */
app.post('/api/tasks', (req, res) => {
  const { title, details, status } = req.body;
  if (!title) {
    return res.status(400).json({ success: false, error: 'Task title is required.' });
  }

  const newTask = {
    id: taskRecords.length + 1,
    title,
    status: status || 'PENDING',
    timestamp: new Date().toISOString(),
    details: details || 'Automated task logged via API'
  };

  taskRecords.unshift(newTask);
  res.status(201).json({ success: true, task: newTask });
});

/**
 * @route   GET /api/stress
 * @desc    Simulate CPU workload to demonstrate Elastic Beanstalk Auto Scaling Group trigger
 */
app.get('/api/stress', (req, res) => {
  const durationMs = Math.min(parseInt(req.query.duration || '500', 10), 3000);
  const start = Date.now();
  
  // Intensive computation loop
  while (Date.now() - start < durationMs) {
    Math.sqrt(Math.random() * 1000000);
  }

  res.json({
    success: true,
    message: `Simulated CPU load completed for ${durationMs}ms`,
    durationMs,
    hostname: os.hostname(),
    timestamp: new Date().toISOString()
  });
});

// Serve frontend single page app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server if invoked directly
let server;
if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(` AWS Week 4: Deployment & Automation Server Active `);
    console.log(` Author: Sakshi Bhalekar                            `);
    console.log(` Listening on port: ${PORT}                         `);
    console.log(` Health Check URL:  http://localhost:${PORT}/health `);
    console.log(` Environment:       ${NODE_ENV}                     `);
    console.log(`====================================================`);
  });

  const gracefulShutdown = () => {
    console.log('Received termination signal. Shutting down gracefully...');
    server.close(() => {
      console.log('HTTP server closed successfully.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}

module.exports = { app, getAwsMetadata };
