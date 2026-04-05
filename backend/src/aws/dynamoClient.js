/**
 * AWS DynamoDB Client
 * Logs simulation sessions and metrics snapshots to the LoadBalancerLogs table.
 * Gracefully degrades if AWS credentials are not configured.
 */
import { DynamoDBClient, CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import dotenv from 'dotenv';

dotenv.config();

const TABLE_NAME = process.env.DYNAMO_TABLE || 'LoadBalancerLogs';
const REGION = process.env.AWS_REGION || 'us-east-1';

let docClient = null;
let isConnected = false;

// Initialize DynamoDB client
function initDynamoClient() {
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.warn('⚠️  AWS credentials not found — DynamoDB logging disabled');
    return;
  }

  try {
    const client = new DynamoDBClient({
      region: REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    docClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: { removeUndefinedValues: true },
    });

    // Ensure table exists on startup
    ensureTable(client);
  } catch (err) {
    console.warn(`⚠️  DynamoDB init failed: ${err.message}`);
  }
}

/**
 * Create the DynamoDB table if it doesn't exist
 */
async function ensureTable(rawClient) {
  try {
    await rawClient.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
    console.log(`✅ DynamoDB table "${TABLE_NAME}" found in ${REGION}`);
    isConnected = true;
  } catch (err) {
    if (err.name === 'ResourceNotFoundException') {
      try {
        await rawClient.send(new CreateTableCommand({
          TableName: TABLE_NAME,
          KeySchema: [
            { AttributeName: 'sessionId', KeyType: 'HASH' },
            { AttributeName: 'timestamp', KeyType: 'RANGE' },
          ],
          AttributeDefinitions: [
            { AttributeName: 'sessionId', AttributeType: 'S' },
            { AttributeName: 'timestamp', AttributeType: 'S' },
          ],
          BillingMode: 'PAY_PER_REQUEST', // On-demand pricing, no provisioning needed
        }));
        console.log(`✅ DynamoDB table "${TABLE_NAME}" created in ${REGION}`);
        isConnected = true;
      } catch (createErr) {
        console.error(`❌ DynamoDB table creation failed: ${createErr.message}`);
      }
    } else {
      console.warn(`⚠️  DynamoDB table check failed: ${err.message}`);
    }
  }
}

/**
 * Log a session lifecycle event (start/stop)
 * @param {string} sessionId - Unique session UUID
 * @param {string} eventType - 'SESSION_START' | 'SESSION_END'
 * @param {Object} data - Additional metadata
 */
export async function logSessionEvent(sessionId, eventType, data = {}) {
  if (!docClient) return;
  try {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        sessionId,
        timestamp: new Date().toISOString(),
        eventType,
        algorithm: data.algorithm || 'unknown',
        requestRate: data.requestRate || 0,
        totalRequests: data.totalRequests || 0,
        metadata: JSON.stringify({
          serverCount: data.serverCount,
          algorithmStats: data.algorithmStats,
        }),
      },
    }));
  } catch (err) {
    // Non-fatal — simulation continues without logging
    console.warn(`DynamoDB write skipped: ${err.message}`);
  }
}

/**
 * Log a periodic metrics snapshot
 * @param {string} sessionId
 * @param {Object} metrics
 */
export async function logMetricsSnapshot(sessionId, metrics) {
  if (!docClient) return;
  try {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        sessionId,
        timestamp: new Date().toISOString(),
        eventType: 'METRICS_SNAPSHOT',
        algorithm: metrics.algorithm,
        totalRequests: metrics.totalRequests,
        requestsPerSecond: metrics.requestsPerSecond,
        serverCount: metrics.servers?.length || 0,
        overloadedCount: metrics.servers?.filter(s => s.status === 'overloaded').length || 0,
        downCount: metrics.servers?.filter(s => s.status === 'down').length || 0,
      },
    }));
  } catch (err) {
    console.warn(`DynamoDB snapshot skipped: ${err.message}`);
  }
}

/**
 * Retrieve recent session logs (for the comparison page)
 * @param {number} limit - Max number of items to return
 * @returns {Array} Array of log items
 */
export async function getRecentLogs(limit = 50) {
  if (!docClient) return [];
  try {
    // NOTE: Do NOT set Limit here — DynamoDB applies Limit BEFORE FilterExpression,
    // which means you'd scan only `limit` raw items and then filter, often returning 0.
    // Instead, scan all matching items and slice client-side.
    const result = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'eventType = :et',
      ExpressionAttributeValues: { ':et': 'SESSION_END' },
    }));
    const items = result.Items || [];
    // Sort newest-first by timestamp string (ISO format sorts lexicographically)
    items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return items.slice(0, limit);
  } catch (err) {
    console.warn(`DynamoDB scan failed: ${err.message}`);
    return [];
  }
}

export function isDynamoConnected() {
  return isConnected;
}

// Initialize on module load
initDynamoClient();
