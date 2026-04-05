/**
 * ec2Manager.js — AWS EC2 + ALB Infrastructure Manager
 *
 * Programmatically provisions:
 *  - EC2 t2.micro instances running a tiny HTTP server
 *  - A Target Group + ALB + Listener that routes real traffic
 *
 * Also handles teardown, health polling, and CloudWatch metric collection.
 */
import {
  EC2Client,
  RunInstancesCommand,
  TerminateInstancesCommand,
  DescribeInstancesCommand,
  DescribeVpcsCommand,
  DescribeSubnetsCommand,
  CreateSecurityGroupCommand,
  AuthorizeSecurityGroupIngressCommand,
  DescribeSecurityGroupsCommand,
  CreateTagsCommand,
  GetConsoleOutputCommand,
} from '@aws-sdk/client-ec2';

import http from 'http';

import {
  ElasticLoadBalancingV2Client,
  CreateLoadBalancerCommand,
  DeleteLoadBalancerCommand,
  CreateTargetGroupCommand,
  DeleteTargetGroupCommand,
  CreateListenerCommand,
  DescribeListenersCommand,
  DeleteListenerCommand,
  RegisterTargetsCommand,
  DeregisterTargetsCommand,
  DescribeLoadBalancersCommand,
  DescribeTargetHealthCommand,
  DescribeTargetGroupsCommand,
  ModifyTargetGroupAttributesCommand,
} from '@aws-sdk/client-elastic-load-balancing-v2';

import {
  CloudWatchClient,
  GetMetricStatisticsCommand,
} from '@aws-sdk/client-cloudwatch';

import dotenv from 'dotenv';
dotenv.config();

const REGION = process.env.AWS_REGION || 'us-east-1';
// Amazon Linux 2 AMI (us-east-1) — update if region differs
const DEFAULT_AMI = process.env.EC2_AMI || 'ami-0c02fb55956c7d316';
const INSTANCE_TYPE = process.env.EC2_INSTANCE_TYPE || 't3.micro';
const TAG_NAME = 'lb-simulator';

// ─── AWS SDK clients ─────────────────────────────────────────────────────────

function makeCredentials() {
  return {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    ...(process.env.AWS_SESSION_TOKEN ? { sessionToken: process.env.AWS_SESSION_TOKEN } : {}),
  };
}

function ec2Client() {
  return new EC2Client({ region: REGION, credentials: makeCredentials() });
}

function elbClient() {
  return new ElasticLoadBalancingV2Client({ region: REGION, credentials: makeCredentials() });
}

function cwClient() {
  return new CloudWatchClient({ region: REGION, credentials: makeCredentials() });
}

// ─── User-data bootstrap script for EC2 (installs + starts tiny HTTP server) ─

function buildUserData(serverName) {
  // Ultra-simple Python one-liner — no file creation, no package install, instant start
  // Python3 is always pre-installed on Amazon Linux 2 / AL2023
  const script = `#!/bin/bash
exec > /var/log/user-data.log 2>&1
echo "Bootstrap start: $(date)"
python3 -c "
import http.server,socketserver,json,time,socket,os
START=time.time()
RC=[0]
DELAY=[0]
STATUS=['ok']
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/crash':
            STATUS[0] = 'down'; self.send_response(200); self.end_headers(); return
        if self.path == '/recover':
            STATUS[0] = 'ok'; DELAY[0] = 0; self.send_response(200); self.end_headers(); return
        if self.path == '/slow':
            DELAY[0] = 2; self.send_response(200); self.end_headers(); return
        if STATUS[0] == 'down':
            self.send_response(503); self.end_headers(); return
        if self.path != '/health' and DELAY[0] > 0:
            time.sleep(DELAY[0])
            
        RC[0]+=1
        self.send_response(200)
        self.send_header('Content-Type','application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'status':STATUS[0],'server':'${serverName}','hostname':socket.gethostname(),'uptime':int(time.time()-START),'requests':RC[0]}).encode())
    def log_message(self,*a):pass
print('${serverName} on :3000')
socketserver.TCPServer(('0.0.0.0',3000),H).serve_forever()
" > /var/log/lb-server.log 2>&1 &
echo "Server PID $! started at $(date)"
echo "Bootstrap done"
`;

  return Buffer.from(script).toString('base64');
}

// ─── VPC / Networking helpers ──────────────────────────────────────────────

/**
 * Discover the default VPC in the current region
 */
async function getDefaultVpc() {
  const client = ec2Client();
  const res = await client.send(new DescribeVpcsCommand({
    Filters: [{ Name: 'isDefault', Values: ['true'] }],
  }));
  const vpc = res.Vpcs?.[0];
  if (!vpc) throw new Error('No default VPC found in ' + REGION + '. Please set VPC_ID in .env');
  return vpc.VpcId;
}

/**
 * Get two public subnets from different AZs in the given VPC
 */
async function getPublicSubnets(vpcId) {
  const client = ec2Client();
  const res = await client.send(new DescribeSubnetsCommand({
    Filters: [
      { Name: 'vpc-id', Values: [vpcId] },
      { Name: 'mapPublicIpOnLaunch', Values: ['true'] },
    ],
  }));

  // Group by AZ, pick one subnet per AZ, return at least 2
  const byAz = {};
  (res.Subnets || []).forEach(s => {
    if (!byAz[s.AvailabilityZone]) byAz[s.AvailabilityZone] = s.SubnetId;
  });
  const subnets = Object.values(byAz);
  if (subnets.length < 2) {
    throw new Error('Need at least 2 public subnets in different AZs. Found: ' + subnets.length);
  }
  return subnets.slice(0, 2);
}

/**
 * Create or reuse a Security Group — always ensures ingress rules are applied
 */
async function getOrCreateSecurityGroup(vpcId) {
  const client = ec2Client();
  const sgName = 'lb-simulator-sg';
  let sgId;

  // Check if it already exists
  const res = await client.send(new DescribeSecurityGroupsCommand({
    Filters: [
      { Name: 'group-name', Values: [sgName] },
      { Name: 'vpc-id', Values: [vpcId] },
    ],
  }));

  if (res.SecurityGroups?.length > 0) {
    sgId = res.SecurityGroups[0].GroupId;
    console.log(`  Reusing security group ${sgId}`);
  } else {
    const created = await client.send(new CreateSecurityGroupCommand({
      GroupName: sgName,
      Description: 'LB Simulator - allows HTTP on port 3000 and 80',
      VpcId: vpcId,
    }));
    sgId = created.GroupId;
    console.log(`  Created security group ${sgId}`);
  }

  // Always ensure ingress rules exist (idempotent — ignore DuplicatePermission errors)
  try {
    await client.send(new AuthorizeSecurityGroupIngressCommand({
      GroupId: sgId,
      IpPermissions: [
        { IpProtocol: 'tcp', FromPort: 80,   ToPort: 80,   IpRanges: [{ CidrIp: '0.0.0.0/0' }] },
        { IpProtocol: 'tcp', FromPort: 3000, ToPort: 3000, IpRanges: [{ CidrIp: '0.0.0.0/0' }] },
      ],
    }));
    console.log(`  Ingress rules applied to ${sgId}`);
  } catch (e) {
    if (e.Code === 'InvalidPermission.Duplicate' || e.name === 'InvalidPermission.Duplicate') {
      console.log(`  Ingress rules already exist on ${sgId} — OK`);
    } else {
      throw e;
    }
  }

  return sgId;
}

// ─── EC2 Management ───────────────────────────────────────────────────────────

const SERVER_NAMES = ['Alpha', 'Beta', 'Gamma'];

/**
 * Launch EC2 instances
 * @param {number} count - How many instances (1–3)
 * @returns {string[]} Array of instance IDs
 */
export async function provisionServers(count = 3) {
  const c = Math.max(1, Math.min(3, count));
  const client = ec2Client();

  const vpcId = process.env.VPC_ID || await getDefaultVpc();
  const subnets = await getPublicSubnets(vpcId);
  const sgId = await getOrCreateSecurityGroup(vpcId);

  const instanceIds = [];

  for (let i = 0; i < c; i++) {
    const name = SERVER_NAMES[i] || `Server-${i}`;
    const subnet = subnets[i % subnets.length];

    const res = await client.send(new RunInstancesCommand({
      ImageId: DEFAULT_AMI,
      InstanceType: INSTANCE_TYPE,
      MinCount: 1,
      MaxCount: 1,
      SubnetId: subnet,
      SecurityGroupIds: [sgId],
      UserData: buildUserData(name),
      ...(process.env.EC2_KEY_PAIR ? { KeyName: process.env.EC2_KEY_PAIR } : {}),
      TagSpecifications: [{
        ResourceType: 'instance',
        Tags: [
          { Key: 'Name', Value: `${TAG_NAME}-${name.toLowerCase()}` },
          { Key: 'Project', Value: TAG_NAME },
          { Key: 'ServerIndex', Value: String(i) },
        ],
      }],
    }));

    const id = res.Instances[0].InstanceId;
    instanceIds.push(id);
    console.log(`  ✅ Launched ${name} → ${id} (subnet: ${subnet})`);
  }

  return instanceIds;
}

/**
 * Wait until all instances reach 'running' state (polls every 10s, max 5 min)
 */
export async function waitForRunning(instanceIds, timeoutMs = 300_000) {
  const client = ec2Client();
  const deadline = Date.now() + timeoutMs;
  console.log('⏳ Waiting for instances to reach running state...');

  while (Date.now() < deadline) {
    const res = await client.send(new DescribeInstancesCommand({ InstanceIds: instanceIds }));
    const instances = (res.Reservations || []).flatMap(r => r.Instances || []);
    const states = instances.map(i => i.State?.Name);
    console.log('   Instance states:', states.join(', '));

    if (states.every(s => s === 'running')) {
      console.log('✅ All instances running!');
      return;
    }
    if (states.some(s => ['terminated', 'shutting-down', 'stopped'].includes(s))) {
      throw new Error('One or more instances terminated unexpectedly: ' + states.join(', '));
    }

    await new Promise(r => setTimeout(r, 10_000)); // poll every 10s
  }
  throw new Error('Timed out waiting for instances to reach running state');
}

/**
 * Terminate EC2 instances — also sweeps for any orphaned lb-simulator instances
 */
export async function terminateServers(instanceIds = []) {
  const client = ec2Client();

  // Find ALL lb-simulator tagged instances (catches orphans from failed deploys)
  const tagRes = await client.send(new DescribeInstancesCommand({
    Filters: [
      { Name: 'tag:Project', Values: ['lb-simulator'] },
      { Name: 'instance-state-name', Values: ['pending', 'running', 'stopping', 'stopped'] },
    ],
  }));
  const taggedIds = (tagRes.Reservations || [])
    .flatMap(r => r.Instances || [])
    .map(i => i.InstanceId);

  // Merge with any explicitly passed IDs
  const allIds = [...new Set([...instanceIds, ...taggedIds])];

  if (allIds.length === 0) {
    console.log('🗑️  No instances to terminate');
    return;
  }

  await client.send(new TerminateInstancesCommand({ InstanceIds: allIds }));
  console.log(`🗑️  Terminated ${allIds.length} instances:`, allIds);
}

/**
 * Poll instance statuses
 * @returns {Array} Array of { id, name, state, publicIp, az }
 */
export async function getInstanceStatuses(instanceIds) {
  if (!instanceIds?.length) return [];
  const res = await ec2Client().send(new DescribeInstancesCommand({
    InstanceIds: instanceIds,
  }));

  return (res.Reservations || []).flatMap(r => r.Instances || []).map(i => ({
    id: i.InstanceId,
    name: i.Tags?.find(t => t.Key === 'Name')?.Value || i.InstanceId,
    state: i.State?.Name || 'unknown',
    publicIp: i.PublicIpAddress || null,
    az: i.Placement?.AvailabilityZone || 'unknown',
  }));
}

/**
 * Get EC2 instance console output (shows user-data logs, boot messages)
 */
export async function getConsoleOutput(instanceId) {
  try {
    const res = await ec2Client().send(new GetConsoleOutputCommand({
      InstanceId: instanceId,
      Latest: true,
    }));
    return res.Output ? Buffer.from(res.Output, 'base64').toString('utf-8') : '(no output yet)';
  } catch (e) {
    return `Error: ${e.message}`;
  }
}

// ─── ALB Management ────────────────────────────────────────────────────────────

/**
 * Create Target Group + ALB + Listener, register instances
 * @param {string[]} instanceIds
 * @returns {{ albArn, targetGroupArn, albDns }}
 */
export async function createALB(instanceIds) {
  const vpcId = process.env.VPC_ID || await getDefaultVpc();
  const subnets = await getPublicSubnets(vpcId);
  const sgId = await getOrCreateSecurityGroup(vpcId);
  const elb = elbClient();

  // 1. Create Target Group (HTTP on port 3000)
  const tgRes = await elb.send(new CreateTargetGroupCommand({
    Name: 'lb-simulator-tg',
    Protocol: 'HTTP',
    Port: 3000,
    VpcId: vpcId,
    TargetType: 'instance',
    HealthCheckProtocol: 'HTTP',
    HealthCheckPort: '3000',
    HealthCheckPath: '/health',
    HealthCheckIntervalSeconds: 15,
    HealthyThresholdCount: 2,
    UnhealthyThresholdCount: 3,
  }));
  const targetGroupArn = tgRes.TargetGroups[0].TargetGroupArn;
  console.log('  ✅ Target Group created:', targetGroupArn);

  // 2. Register instances as targets
  await elb.send(new RegisterTargetsCommand({
    TargetGroupArn: targetGroupArn,
    Targets: instanceIds.map(id => ({ Id: id, Port: 3000 })),
  }));
  console.log('  ✅ Registered targets:', instanceIds);

  // 3. Create internal ALB
  const albRes = await elb.send(new CreateLoadBalancerCommand({
    Name: 'lb-simulator-alb',
    Subnets: subnets,
    SecurityGroups: [sgId],
    Scheme: 'internet-facing',
    Type: 'application',
    IpAddressType: 'ipv4',
    Tags: [{ Key: 'Project', Value: TAG_NAME }],
  }));
  const alb = albRes.LoadBalancers[0];
  const albArn = alb.LoadBalancerArn;
  const albDns = alb.DNSName;
  console.log('  ✅ ALB created:', albDns);

  // 4. Create Listener (port 80 → target group)
  await elb.send(new CreateListenerCommand({
    LoadBalancerArn: albArn,
    Protocol: 'HTTP',
    Port: 80,
    DefaultActions: [{
      Type: 'forward',
      TargetGroupArn: targetGroupArn,
    }],
  }));
  console.log('  ✅ Listener created on port 80');

  return { albArn, targetGroupArn, albDns };
}

/**
 * Delete ALB + Target Group safely
 * Deletes listeners first, then ALB, then waits before deleting TG (with retries)
 */
export async function deleteALB(albArn, targetGroupArn) {
  const elb = elbClient();

  if (albArn) {
    // 1. Delete all listeners first so TG is no longer "in use"
    try {
      const listRes = await elb.send(new DescribeListenersCommand({ LoadBalancerArn: albArn }));
      for (const listener of listRes.Listeners || []) {
        await elb.send(new DeleteListenerCommand({ ListenerArn: listener.ListenerArn }));
        console.log('🗑️  Deleted listener:', listener.ListenerArn);
      }
    } catch (e) {
      console.warn('Could not list/delete listeners (may already be gone):', e.message);
    }

    // 2. Delete the ALB
    try {
      await elb.send(new DeleteLoadBalancerCommand({ LoadBalancerArn: albArn }));
      console.log('🗑️  Deleted ALB:', albArn);
    } catch (e) {
      console.warn('ALB delete error (may already be gone):', e.message);
    }
  }

  // 3. Wait for ALB to fully drain before deleting TG (retry up to 5x)
  if (targetGroupArn) {
    for (let attempt = 1; attempt <= 5; attempt++) {
      await new Promise(r => setTimeout(r, 10_000)); // 10s between attempts
      try {
        await elb.send(new DeleteTargetGroupCommand({ TargetGroupArn: targetGroupArn }));
        console.log('🗑️  Deleted Target Group:', targetGroupArn);
        break;
      } catch (e) {
        if (e.Code === 'ResourceInUse' || e.name === 'ResourceInUse' || e.message?.includes('in use')) {
          console.log(`  TG still in use, retry ${attempt}/5 in 10s...`);
        } else {
          console.warn('TG delete error:', e.message);
          break;
        }
      }
    }
  }
}

/**
 * Update ALB Target Group Algorithm
 * Supports 'roundRobin' (round_robin) and 'leastConnections' (least_outstanding_requests)
 */
export async function setTargetGroupAlgorithm(targetGroupArn, algorithmType) {
  if (!targetGroupArn) return false;
  const algMap = {
    roundRobin: 'round_robin',
    leastConnections: 'least_outstanding_requests',
  };
  const awsAlg = algMap[algorithmType] || 'round_robin';
  
  try {
    await elbClient().send(new ModifyTargetGroupAttributesCommand({
      TargetGroupArn: targetGroupArn,
      Attributes: [
        { Key: 'load_balancing.algorithm.type', Value: awsAlg }
      ]
    }));
    console.log(`  ✅ Target Group algorithm instantly updated to: ${awsAlg}`);
    return true;
  } catch (e) {
    console.warn(`⚠️ Failed to update AWS algorithm to ${awsAlg}:`, e.message);
    return false;
  }
}

/**
 * Get ALB target health
 */
export async function getTargetHealth(targetGroupArn) {
  if (!targetGroupArn) return [];
  try {
    const res = await elbClient().send(new DescribeTargetHealthCommand({
      TargetGroupArn: targetGroupArn,
    }));
    return (res.TargetHealthDescriptions || []).map(t => ({
      instanceId: t.Target?.Id,
      port: t.Target?.Port,
      state: t.TargetHealth?.State,
      reason: t.TargetHealth?.Reason,
    }));
  } catch { return []; }
}

/**
 * Get ALB metrics from CloudWatch (request count + latency)
 */
export async function getALBMetrics(albArn) {
  if (!albArn) return { requestCount: 0, avgLatencyMs: 0 };

  try {
    const cw = cwClient();
    const albName = albArn.split('/').slice(1).join('/'); // strip arn prefix noise
    const dimensions = [{ Name: 'LoadBalancer', Value: albName }];
    const endTime = new Date();
    const startTime = new Date(endTime - 5 * 60 * 1000); // last 5 min

    const [reqRes, latRes] = await Promise.all([
      cw.send(new GetMetricStatisticsCommand({
        Namespace: 'AWS/ApplicationELB',
        MetricName: 'RequestCount',
        Dimensions: dimensions,
        StartTime: startTime,
        EndTime: endTime,
        Period: 300,
        Statistics: ['Sum'],
      })),
      cw.send(new GetMetricStatisticsCommand({
        Namespace: 'AWS/ApplicationELB',
        MetricName: 'TargetResponseTime',
        Dimensions: dimensions,
        StartTime: startTime,
        EndTime: endTime,
        Period: 300,
        Statistics: ['Average'],
      })),
    ]);

    const requestCount = reqRes.Datapoints?.[0]?.Sum || 0;
    const avgLatencyMs = Math.round((latRes.Datapoints?.[0]?.Average || 0) * 1000);

    return { requestCount, avgLatencyMs };
  } catch (err) {
    console.warn('CloudWatch metrics error:', err.message);
    return { requestCount: 0, avgLatencyMs: 0 };
  }
}

// ─── Individual Instance Management ──────────────────────────────────────────

/**
 * Launch a single EC2 instance and register it to the Target Group
 */
export async function addSingleInstance(targetGroupArn) {
  const client = ec2Client();
  const vpcId = process.env.VPC_ID || await getDefaultVpc();
  const subnets = await getPublicSubnets(vpcId);
  const sgId = await getOrCreateSecurityGroup(vpcId);

  // Pick a random subnet or just the first one
  const subnet = subnets[0];
  const name = `Extra-${Math.floor(Math.random() * 1000)}`;

  const res = await client.send(new RunInstancesCommand({
    ImageId: DEFAULT_AMI,
    InstanceType: INSTANCE_TYPE,
    MinCount: 1,
    MaxCount: 1,
    SubnetId: subnet,
    SecurityGroupIds: [sgId],
    UserData: buildUserData(name),
    TagSpecifications: [{
      ResourceType: 'instance',
      Tags: [
        { Key: 'Name', Value: `${TAG_NAME}-${name.toLowerCase()}` },
        { Key: 'Project', Value: TAG_NAME },
      ],
    }],
  }));

  const instanceId = res.Instances[0].InstanceId;
  console.log(`  ✅ Launched extra instance: ${instanceId}`);

  // Wait for running state then register
  await waitForRunning([instanceId]);

  const elb = elbClient();
  await elb.send(new RegisterTargetsCommand({
    TargetGroupArn: targetGroupArn,
    Targets: [{ Id: instanceId, Port: 3000 }],
  }));
  console.log(`  ✅ Registered ${instanceId} to TG: ${targetGroupArn}`);

  return instanceId;
}

/**
 * Deregister a specific instance from the TG and terminate it
 */
export async function removeSingleInstance(instanceId, targetGroupArn) {
  const elb = elbClient();

  // 1. Deregister from TG
  if (targetGroupArn) {
    try {
      await elb.send(new DeregisterTargetsCommand({
        TargetGroupArn: targetGroupArn,
        Targets: [{ Id: instanceId, Port: 3000 }],
      }));
      console.log(`  🗑️ Deregistered ${instanceId} from TG`);
      // Optional: wait a bit for draining? 
      await new Promise(r => setTimeout(r, 5000));
    } catch (e) {
      console.warn(`Failed to deregister ${instanceId}:`, e.message);
    }
  }

  // 2. Terminate EC2
  const ec2 = ec2Client();
  await ec2.send(new TerminateInstancesCommand({ InstanceIds: [instanceId] }));
  console.log(`  🗑️ Terminated instance: ${instanceId}`);
}

/**
 * Send HTTP command directly to EC2 bypassing ALB
 */
export async function sendNodeCommand(publicIp, command) {
  if (!publicIp) return false;
  return new Promise((resolve) => {
    http.get(`http://${publicIp}:3000/${command}`, (res) => {
      resolve(res.statusCode === 200 || res.statusCode === 503);
    }).on('error', (e) => {
      console.warn(`[Node Command] Failed to send /${command} to ${publicIp}:`, e.message);
      resolve(false);
    });
  });
}


