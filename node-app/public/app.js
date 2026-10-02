/**
 * AWS Cloud Foundations (Week 4) - Frontend Dashboard Controller
 * Author: Sakshi Bhalekar
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const headerStatusText = document.getElementById('headerStatusText');
  const headerEnv = document.getElementById('headerEnv');
  const statCompute = document.getElementById('statCompute');
  const statInstanceId = document.getElementById('statInstanceId');
  const statAz = document.getElementById('statAz');
  const statPrivateIp = document.getElementById('statPrivateIp');
  const statInstanceType = document.getElementById('statInstanceType');
  const statOs = document.getElementById('statOs');
  const statNodeVersion = document.getElementById('statNodeVersion');
  const statMemory = document.getElementById('statMemory');

  const badgeHealth = document.getElementById('badgeHealth');
  const statTgStatus = document.getElementById('statTgStatus');
  const statLatency = document.getElementById('statLatency');
  const statDns = document.getElementById('statDns');
  const statUptime = document.getElementById('statUptime');
  const statLastPing = document.getElementById('statLastPing');

  const btnRefreshInfo = document.getElementById('btnRefreshInfo');
  const btnTestHealth = document.getElementById('btnTestHealth');
  const btnTestInfo = document.getElementById('btnTestInfo');
  const btnTestStress = document.getElementById('btnTestStress');
  const btnAddTaskModal = document.getElementById('btnAddTaskModal');
  const btnClearTerminal = document.getElementById('btnClearTerminal');
  const terminalOutput = document.getElementById('terminalOutput');

  const tasksTableBody = document.getElementById('tasksTableBody');
  const taskCountBadge = document.getElementById('taskCountBadge');

  function logTerminal(content, isError = false) {
    const timestamp = new Date().toLocaleTimeString();
    const formatted = typeof content === 'object' ? JSON.stringify(content, null, 2) : content;
    terminalOutput.textContent = `[${timestamp}] ${formatted}\n\n` + terminalOutput.textContent;
  }

  // Fetch Health Check & measure latency
  async function checkHealth() {
    const start = performance.now();
    try {
      const response = await fetch('/health');
      const latency = Math.round(performance.now() - start);
      const data = await response.json();

      if (response.ok && data.status === 'healthy') {
        badgeHealth.textContent = `HTTP ${response.status} OK`;
        badgeHealth.className = 'badge badge-green';
        headerStatusText.textContent = 'ALB: HEALTHY';
        statTgStatus.textContent = 'Healthy (2/2 Passed)';
        statLatency.textContent = `${latency} ms`;
        statUptime.textContent = `${data.uptimeSeconds} seconds`;
        statLastPing.textContent = new Date().toLocaleTimeString();
        if (data.environment) headerEnv.textContent = data.environment;
        return { data, latency };
      } else {
        throw new Error(`Unexpected status: ${data.status}`);
      }
    } catch (err) {
      badgeHealth.textContent = 'DEGRADED';
      badgeHealth.className = 'badge badge-warning';
      headerStatusText.textContent = 'ALB: DEGRADED';
      statTgStatus.textContent = 'Degraded';
      statLatency.textContent = 'Timeout / Err';
      return null;
    }
  }

  // Fetch Node & Cloud Metadata
  async function fetchTelemetry() {
    try {
      const res = await fetch('/api/info');
      const data = await res.json();
      if (!data.success) return;

      const app = data.application;
      const infra = data.infrastructure;
      const sys = data.system;
      const aws = infra.awsMetadata;

      statCompute.textContent = infra.platform;
      statInstanceId.textContent = aws.instanceId;
      statAz.textContent = aws.availabilityZone;
      statPrivateIp.textContent = aws.privateIp;
      statInstanceType.textContent = aws.instanceType;
      statOs.textContent = `${sys.platform} (${sys.arch}) - ${sys.hostname}`;
      statNodeVersion.textContent = app.nodeVersion;
      statMemory.textContent = `${sys.freeMemoryMB} MB free / ${sys.totalMemoryMB} MB total`;
      statDns.textContent = infra.route53Domain;

      return data;
    } catch (err) {
      console.error('Failed to load telemetry:', err);
    }
  }

  // Fetch Tasks List
  async function fetchTasks() {
    try {
      const res = await fetch('/api/tasks');
      const data = await res.json();
      if (!data.success) return;

      taskCountBadge.textContent = `${data.count} Tasks`;
      tasksTableBody.innerHTML = '';

      data.tasks.forEach(task => {
        const tr = document.createElement('tr');
        const badgeClass = task.status === 'COMPLETED' ? 'badge-green' : 'badge-warning';
        
        tr.innerHTML = `
          <td class="font-mono">#${task.id}</td>
          <td><strong>${escapeHtml(task.title)}</strong></td>
          <td><span class="badge ${badgeClass}">${escapeHtml(task.status)}</span></td>
          <td class="font-mono text-muted">${new Date(task.timestamp).toLocaleTimeString()}</td>
          <td class="text-muted">${escapeHtml(task.details)}</td>
        `;
        tasksTableBody.appendChild(tr);
      });

      return data;
    } catch (err) {
      console.error('Failed to load tasks:', err);
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[m]);
  }

  // Button Listeners
  btnTestHealth.addEventListener('click', async () => {
    logTerminal('Sending GET request to Elastic Beanstalk /health endpoint...');
    const result = await checkHealth();
    if (result) {
      logTerminal(result.data);
    } else {
      logTerminal('Health check failed or timed out.', true);
    }
  });

  btnTestInfo.addEventListener('click', async () => {
    logTerminal('Querying /api/info (AWS EC2 IMDSv2 + System Telemetry)...');
    try {
      const res = await fetch('/api/info');
      const data = await res.json();
      logTerminal(data);
    } catch (err) {
      logTerminal({ error: err.message }, true);
    }
  });

  btnTestStress.addEventListener('click', async () => {
    logTerminal('Triggering CPU workload test via GET /api/stress?duration=800...');
    try {
      const res = await fetch('/api/stress?duration=800');
      const data = await res.json();
      logTerminal(data);
    } catch (err) {
      logTerminal({ error: err.message }, true);
    }
  });

  btnAddTaskModal.addEventListener('click', async () => {
    const taskTitle = prompt('Enter Task Title (e.g., "ACM SSL Certificate Validation"):');
    if (!taskTitle) return;
    const taskDetails = prompt('Enter Details (e.g., "Route 53 CNAME DNS validation succeeded"):') || 'Automated entry';

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskTitle,
          details: taskDetails,
          status: 'COMPLETED'
        })
      });
      const data = await res.json();
      logTerminal(data);
      await fetchTasks();
    } catch (err) {
      logTerminal({ error: err.message }, true);
    }
  });

  btnRefreshInfo.addEventListener('click', async () => {
    await fetchTelemetry();
    await checkHealth();
    logTerminal('Refreshed telemetry and health status.');
  });

  btnClearTerminal.addEventListener('click', () => {
    terminalOutput.textContent = '// Terminal cleared.';
  });

  // Initial runs
  checkHealth();
  fetchTelemetry();
  fetchTasks();

  // Poll health every 15 seconds (matching ALB health check interval)
  setInterval(checkHealth, 15000);
});
