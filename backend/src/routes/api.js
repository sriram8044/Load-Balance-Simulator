/**
 * REST API Routes
 * Provides HTTP endpoints for controlling the simulation and fetching metrics.
 */
import { Router } from 'express';
import { simulationEngine } from '../simulation/SimulationEngine.js';
import { realModeEngine } from '../simulation/RealModeEngine.js';
import { getRecentLogs, isDynamoConnected } from '../aws/dynamoClient.js';
import { getConsoleOutput } from '../aws/ec2Manager.js';

const router = Router();

/**
 * POST /api/start-simulation
 * Body: { requestRate: number, algorithm: string }
 */
router.post('/start-simulation', (req, res) => {
  const { requestRate = 5, algorithm = 'roundRobin' } = req.body;
  const result = simulationEngine.start(requestRate, algorithm);
  res.json(result);
});

/**
 * POST /api/stop-simulation
 */
router.post('/stop-simulation', (req, res) => {
  const result = simulationEngine.stop();
  res.json(result);
});

/**
 * POST /api/set-algorithm
 * Body: { algorithm: string }
 */
router.post('/set-algorithm', (req, res) => {
  const { algorithm } = req.body;
  const result = simulationEngine.setAlgorithm(algorithm);
  res.json(result);
});

/**
 * POST /api/set-rate
 * Body: { rate: number }
 */
router.post('/set-rate', (req, res) => {
  const { rate } = req.body;
  const result = simulationEngine.setRequestRate(rate);
  res.json(result);
});

/**
 * GET /api/get-metrics
 * Returns current simulation snapshot
 */
router.get('/get-metrics', (req, res) => {
  res.json(simulationEngine.getMetrics());
});

/**
 * GET /api/servers-status
 * Returns just the server array
 */
router.get('/servers-status', (req, res) => {
  const metrics = simulationEngine.getMetrics();
  res.json({ servers: metrics.servers });
});

/**
 * POST /api/trigger-failure
 * Randomly marks one healthy server as down
 */
router.post('/trigger-failure', (req, res) => {
  const result = simulationEngine.triggerFailure();
  res.json(result);
});

/**
 * POST /api/recover-server
 * Body: { serverId: string }
 */
router.post('/recover-server', (req, res) => {
  const { serverId } = req.body;
  const result = simulationEngine.recoverServer(serverId);
  res.json(result);
});

/**
 * POST /api/recover-all
 * Recover all downed servers
 */
router.post('/recover-all', (req, res) => {
  const result = simulationEngine.recoverAll();
  res.json(result);
});

/**
 * POST /api/add-server
 * Auto-scale up — add a new server
 */
router.post('/add-server', (req, res) => {
  const result = simulationEngine.addServer();
  res.json(result);
});

/**
 * POST /api/remove-server
 * Auto-scale down — remove last server
 */
router.post('/remove-server', (req, res) => {
  const result = simulationEngine.removeServer();
  res.json(result);
});

/**
 * POST /api/reset
 * Full simulation reset to initial state
 */
router.post('/reset', (req, res) => {
  const result = simulationEngine.reset();
  res.json(result);
});

/**
 * GET /api/algorithm-stats
 * Returns per-algorithm comparison statistics
 */
router.get('/algorithm-stats', (req, res) => {
  const metrics = simulationEngine.getMetrics();
  res.json({
    stats: metrics.algorithmStats,
    currentAlgorithm: metrics.algorithm,
  });
});

/**
 * GET /api/cloud-logs
 * Retrieve recent session logs from DynamoDB
 */
router.get('/cloud-logs', async (req, res) => {
  const logs = await getRecentLogs(20);
  res.json({
    connected: isDynamoConnected(),
    logs,
  });
});

// ─── Real AWS Infrastructure routes ───────────────────────────────────────────

/**
 * POST /api/provision
 * Launch EC2 instances + ALB. Long-running — responds immediately, status via WS.
 */
router.post('/provision', async (req, res) => {
  // Start async, respond immediately
  res.json({ success: true, message: 'Provisioning started — watch infra-status events' });
  realModeEngine.provision();
});

/**
 * POST /api/destroy
 * Terminate all real infrastructure
 */
router.post('/destroy', async (req, res) => {
  const result = await realModeEngine.destroy();
  res.json(result);
});

/**
 * GET /api/infra-status
 * Returns current real infrastructure state
 */
router.get('/infra-status', (req, res) => {
  res.json(realModeEngine.getStatus());
});

/**
 * GET /api/real-metrics
 * Returns latest real traffic metrics
 */
router.get('/real-metrics', (req, res) => {
  res.json(realModeEngine.getMetrics());
});

/**
 * GET /api/real-algorithm-stats
 * Returns per-algorithm comparison statistics for real mode
 */
router.get('/real-algorithm-stats', (req, res) => {
  const metrics = realModeEngine.getMetrics();
  res.json({
    stats: metrics.algorithmStats,
    currentAlgorithm: metrics.algorithm,
  });
});

/**
 * POST /api/real-add-server
 * Provision one extra EC2 instance
 */
router.post('/real-add-server', async (req, res) => {
  const result = await realModeEngine.addServer();
  res.json(result);
});

/**
 * POST /api/real-remove-server
 * Terminate a specific EC2 instance
 */
router.post('/real-remove-server', async (req, res) => {
  const { instanceId } = req.body;
  const result = await realModeEngine.removeServer(instanceId);
  res.json(result);
});

/**
 * POST /api/real-slow-server
 * Overloads EC2 instance, causing a 2-second delay on responses. Tests Load Balancing algorithms.
 */
router.post('/real-slow-server', async (req, res) => {
  const { instanceId } = req.body;
  const result = await realModeEngine.applyInstanceCommand(instanceId, 'slow');
  res.json(result);
});

/**
 * POST /api/real-crash-server
 * Kills EC2 instance by returning 503 to AWS ALB Health Check
 */
router.post('/real-crash-server', async (req, res) => {
  const { instanceId } = req.body;
  const result = await realModeEngine.applyInstanceCommand(instanceId, 'crash');
  res.json(result);
});

/**
 * POST /api/real-recover-server
 * Recovers EC2 instance back to normal state
 */
router.post('/real-recover-server', async (req, res) => {
  const { instanceId } = req.body;
  const result = await realModeEngine.applyInstanceCommand(instanceId, 'recover');
  res.json(result);
});

/**
 * POST /api/real-start
 * Body: { requestRate: number, algorithm: string }
 * Start real HTTP traffic to the ALB
 */
router.post('/real-start', (req, res) => {
  const { requestRate = 5, algorithm = 'roundRobin' } = req.body;
  const result = realModeEngine.start(requestRate, algorithm);
  res.json(result);
});

/**
 * POST /api/real-stop
 * Stop traffic + log session to DynamoDB
 */
router.post('/real-stop', (req, res) => {
  const result = realModeEngine.stop();
  res.json(result);
});

/**
 * POST /api/real-set-rate
 * Body: { rate: number }
 */
router.post('/real-set-rate', (req, res) => {
  const { rate } = req.body;
  const result = realModeEngine.setRequestRate(rate);
  res.json(result);
});

/**
 * POST /api/force-cleanup
 * Terminates ALL lb-simulator tagged EC2s + deletes ALBs/TGs — bypasses app state
 */
router.post('/force-cleanup', async (req, res) => {
  const results = [];
  try {
    // 1. Terminate all tagged instances
    const { terminateServers } = await import('../aws/ec2Manager.js');
    await terminateServers([]);
    results.push('Terminated all lb-simulator EC2 instances');

    // 2. Delete all lb-simulator ALBs
    const { ElasticLoadBalancingV2Client, DescribeLoadBalancersCommand, DeleteLoadBalancerCommand,
            DescribeTargetGroupsCommand, DeleteTargetGroupCommand } =
      await import('@aws-sdk/client-elastic-load-balancing-v2');
    const elbClient = new ElasticLoadBalancingV2Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        ...(process.env.AWS_SESSION_TOKEN ? { sessionToken: process.env.AWS_SESSION_TOKEN } : {}),
      },
    });

    const albRes = await elbClient.send(new DescribeLoadBalancersCommand({ Names: ['lb-simulator-alb'] })).catch(() => ({ LoadBalancers: [] }));
    for (const alb of albRes.LoadBalancers || []) {
      await elbClient.send(new DeleteLoadBalancerCommand({ LoadBalancerArn: alb.LoadBalancerArn }));
      results.push(`Deleted ALB: ${alb.LoadBalancerArn}`);
    }

    await new Promise(r => setTimeout(r, 5000));

    const tgRes = await elbClient.send(new DescribeTargetGroupsCommand({ Names: ['lb-simulator-tg'] })).catch(() => ({ TargetGroups: [] }));
    for (const tg of tgRes.TargetGroups || []) {
      await elbClient.send(new DeleteTargetGroupCommand({ TargetGroupArn: tg.TargetGroupArn }));
      results.push(`Deleted TG: ${tg.TargetGroupArn}`);
    }

    // 3. Reset engine state
    realModeEngine.instanceIds = [];
    realModeEngine.albArn = null;
    realModeEngine.targetGroupArn = null;
    realModeEngine.albDns = null;
    realModeEngine.provisioned = false;
    realModeEngine.provisioning = false;

    res.json({ success: true, results });
  } catch (e) {
    res.json({ success: false, error: e.message, results });
  }
});

/**
 * GET /api/debug-instance/:id
 * Returns raw EC2 console output (user-data boot log) for debugging
 */
router.get('/debug-instance/:id', async (req, res) => {
  const log = await getConsoleOutput(req.params.id);
  res.json({ instanceId: req.params.id, log });
});

export default router;
