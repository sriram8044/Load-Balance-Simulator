# ⚡ AWS Cloud Infrastructure Load Balancer Visualizer

> A full-stack, cloud-native web application that provisions **real AWS infrastructure** (Elastic Compute Cloud, Application Load Balancer) to visualize how traffic is logically routed in the cloud. It pairs real backend cloud architecture with an incredibly detailed, interactive React frontend dashboard.

---

## 📋 Table of Contents

1. [What Is This Project?](#-what-is-this-project)
2. [The Website Interface In Depth](#-the-website-interface-in-depth)
   - [Live Output Layout](#live-output-layout)
   - [Page 1: The Dashboard](#page-1-the-dashboard)
   - [Page 2: Strategy Comparison & Logs](#page-2-strategy-comparison--logs)
3. [Real AWS Architecture](#-real-aws-architecture)
4. [Load Balancing Algorithms on AWS](#-load-balancing-algorithms-on-aws)
5. [Chaos Engineering & Node Failures](#-chaos-engineering--node-failures)
6. [Real-Time Metrics (WebSockets)](#-real-time-metrics-websockets)
7. [How to Run](#-how-to-run)

---

## 🎯 What Is This Project?

Unlike typical software simulations, this project interacts with actual physical hardware on AWS. When you launch the simulator, the Node.js backend uses the AWS SDK to build a real cloud environment (EC2 VMs and Application Load Balancers). 

The magic, however, happens on the **Website Frontend**. The web app provides a mission-control command center where you can start firing live HTTP botnet traffic at your AWS load balancer. As Amazon routes the traffic, your website uses WebSockets to instantly draw animated charts, load bars, and pie charts—showing you exactly what your cloud cluster is doing under pressure.

---

## 🖥️ The Website Interface In Depth

### Live Output Layout

When you open the web application, you are greeted with this highly complex, responsive dashboard map:

```text
┌─────────────────────────────────────────────────────────┐
│  ⚡ LB Simulator    [Dashboard] [Comparison]   [● Live] │  ← Navbar
├─────────────────────────────────────────────────────────┤
│  REQ/S: 5   │  TOTAL: 1,240  │  6H·0O·0D  │  Avg: 2s  │  ← Metric Cards
├──────────────────────────────┬──────────────────────────┤
│  AWS Servers Grid            │  Algorithm Selector      │
│  ┌────────┐ ┌────────┐       │  ○ Round Robin           │
│  │ Alpha  │ │ Beta   │       │  ● Least Connections     │
│  │ 45%    │ │ 12%    │       │  ○ Weighted RR            │
│  └────────┘ └────────┘       ├──────────────────────────┤
│  ┌────────┐ ┌────────┐       │  Simulation Controls     │
│  │ Gamma  │ │ Delta  │       │  [▶ Start] [Rate: ====]  │
│  │ 67%    │ │ 34%    │       ├──────────────────────────┤
│  └────────┘ └────────┘       │  📊 Traffic Line Chart    │
│                              ├──────────────────────────┤
│  📊 Bar Chart (Server Loads) │  🥧 Distribution Pie     │
└──────────────────────────────┴──────────────────────────┘
```

---

### Page 1: The Dashboard
This is your command center. It consists of the following detailed components:

#### 1. Metric Cards (Top Row)
Four summary cards give you a quick health snapshot of your entire AWS cluster:
- **REQ / SECOND:** How many real HTTP requests are currently being fired at the AWS Load Balancer.
- **TOTAL REQUESTS:** Cumulative count of all requests processed in the current session.
- **SERVERS STATUS:** A quick glance tally (e.g., `3H · 0O · 0D`), representing Healthy (H), Overloaded (O), and Down (D) nodes.
- **AVG RESP. TIME:** Average response latency (in milliseconds) across all physical servers.

#### 2. The Server Grid
This grid displays a glassmorphic card for each physical EC2 instance running in your cloud. Each card updates every 500 milliseconds.

```text
┌─────────────────────────────────────────┐
│ 🖥️ Alpha              [Healthy]          │  ← Name + Status Badge
│    srv-12649f5a                          │  ← Unique EC2 Node ID
│                                          │
│ Load                               45%  │  ← Real-Time Load %
│ ████████████░░░░░░░░░░░░░░░            │  ← Active Load Bar
│ 27 / 60 active HTTP connections         │  
│                                          │
│ ⚙ CPU    11%   ↗ Processed   1,240     │  ← Processed Request Count
│ ⏱ Resp.  2s    ↗ Weight      3         │  ← Avg Node Latency
└─────────────────────────────────────────┘
```
- **Status Badge:** Instantly changes color (Green = Healthy, Amber = Overloaded, Red = Down).
- **Connection Load Bar:** A progress bar that fills up as AWS routes more traffic to that specific node. If it hits 75% capacity, the whole card glows amber.

#### 3. Simulation Controls Panel
The right-side panel gives you complete control over the live AWS infrastructure:

```text
┌─────────────────────────────────────────┐
│ [▶ Start Firing Traffic]    [↺ Reset]   │
├─────────────────────────────────────────┤
│ REQUEST RATE                   15 req/s │
│ [1]══════○═══════════════════[50]       │
├─────────────────────────────────────────┤
│ CHAOS ENGINEERING                       │
│ [⚠ Trigger Node Failure]                 │
└─────────────────────────────────────────┘
```
- **Active Load Balancing Algorithm:** Click to instantly swap the AWS Target Group between **Round Robin** and **Least Connections** mid-flight.
- **Traffic Slider:** Slide from `1 req/s` up to a massive `50 req/s` to stress-test your system dynamically.
- **Chaos Engineering (Random Failure):** Click this to deliberately crash one of your AWS EC2 servers and watch how the Load Balancer instantly re-routes traffic to the surviving servers.
- **Auto-Scaling:** Click "+ Add Server" or "- Remove" to simulate horizontal scaling by bringing new EC2 instances online dynamically.

#### 4. Real-Time Charts

**The Traffic Area Chart:** A scrolling 30-second timeline showing your requests-per-second volume.
```text
RPS ↑
 50 │                ___
 35 │            ___/   \___
 20 │        ___/           \___
  5 │_______/                   \____
    └──────────────────────────────→ Time (last 30 seconds)
```

**Distribution Donut Chart:** A beautiful, responsive pie chart showing exactly what percentage of total traffic each AWS server has handled.
```text
        Alpha  30%
      ╱‾‾‾‾‾‾‾╲
    Beta        Gamma
    15%          28%
      ╲_______╱
        Delta  
         27%    
```

**Bottom Bar Chart:** A side-by-side bar graph comparing the live stress load percentage across all nodes simultaneously.
```text
Load %
100│
 75│           ████
 50│      ████ ████ ████
 25│ ████ ████ ████ ████
  0└────────────────────────
    Alpha Beta Gamma Delta 
```

---

### Page 2: Strategy Comparison & Logs
Click "Comparison" in the Navigation bar to deeply analyze how differently the algorithms performed under identical traffic conditions.

#### 1. Dive Data Table
A comprehensive row-by-row matrix proving which algorithm is superior (Least Connections will mathematically show a higher "Fairness Score" and 0 overload events compared to Round Robin during variable traffic lengths). You can also export this straight to CSV.

#### 2. Live AWS DynamoDB Logs Viewer
At the bottom is a raw terminal-style read-out pinging your `LoadBalancerLogs` NoSQL table in AWS `us-east-1`. It proves your session metrics are actually being safely archived in the cloud, loading past historical sessions into view.

```text
☁ AWS DynamoDB — Session Logs           ✅ Connected (us-east-1)  [↺]
─────────────────────────────────────────────────────────────────────
  14:15:32   Round Robin    · 1,240 requests over this session
  13:58:10   Least Conn.    ·  580 requests over this session
  13:42:05   Weighted RR    ·  320 requests over this session
```

---

## ☁️ Real AWS Architecture

Here is the lifecycle of how the app provisions and uses the AWS infrastructure behind the scenes:

### 1. Bootstrapping EC2 Instances
When you click **Provision**, your backend automates the deployment via the AWS SDK:
* **Networking:** It queries the Default VPC and configures a Security Group that opens ports 80 (HTTP) and 3000 (Node API).
* **Automated Python Web Servers:** It launches EC2 instances and injects a custom `UserData` bootstrapping script. The moment the VMs boot up, they install a custom Python HTTP web server listening on port 3000. These python servers reply to traffic with a unique JSON signature (e.g., `"I am Alpha"`).

### 2. The Application Load Balancer
The backend simultaneously creates an Application Load Balancer and a Target Group. It registers the newly booted EC2 instances into the Target Group. The Load Balancer binds to Port 80 and begins forwarding external requests directly to the Python instances on Port 3000.

### 3. Firing Real Traffic
Your Node.js core includes a `trafficGenerator` module. When you start the simulation, the module spawns real, asynchronous HTTP requests hitting the AWS ALB DNS URL at your requested rate. 
By capturing the JSON responses from the Python scripts, the frontend Website charts map exactly which physical AWS node handled which request.

---

## 🔄 Load Balancing Algorithms on AWS

Because we are using real infrastructure, the **AWS ALB itself** does the routing. Your custom backend modifies the Target Group attributes on the fly to swap these native rules instantly.

### 1. Default: Round Robin
* **How it works:** AWS blindly hands one HTTP request to Alpha, then Beta, then Gamma, and repeats sequentially.
* **The Vulnerability:** If you artificially force an EC2 instance to take 2 seconds to respond (using a "Slow Down" button), the AWS ALB does not care. It continues sending 33% of the traffic into the overloaded node, causing massive latency spikes and dropped packets.

### 2. Advanced: Least Connections (`least_outstanding_requests`)
* **How it works:** AWS dynamically tracks the active HTTP connection pool of each node. It bypasses sequential order and always forwards the new request to the node with the lowest current workload.
* **The Magic:** If you trigger a slow server in this mode, the AWS ALB instantly detects the bottleneck. It dynamically reroutes almost all incoming traffic to the fast, healthy servers.

---

## ⚠ Chaos Engineering & Node Failures

This system allows you to visibly simulate catastrophic data center failures on the website:
1. **Trigger Failure:** If you click "Trigger Random Failure" on the UI, the Node.js backend pings a hidden route on the target EC2 node (e.g. `[IP]:3000/crash`).
2. **Self-Termination:** The Python HTTP server flags itself as "Terminated" and instantly begins throwing `503 Service Unavailable` errors.
3. **AWS Auto-Healing:** The AWS ALB Target Group health checks see the 503 errors and officially marks the EC2 instance as *Unhealthy*. Amazon AWS natively stops sending traffic to the failed node, and the website updates the UI to show the Server Card glowing red.
4. **Auto-Crashing:** If you crank the request rate up too high (over 15-20 requests per second per node), the backend engine natively detects the overload and triggers an automated crash script, perfectly simulating a physical server cluster buckling under pressure!

---

## ⚡ Real-Time Metrics (WebSockets)

Because traditional HTTP API polling is too slow to visualize live data center metrics, the frontend and backend communicate strictly via **Socket.io**.

Instead of the React frontend constantly asking for data, the Node.js backend pushes a massive JSON metrics blob every 500 milliseconds. This binary socket push is what allows all 12 charts, text fields, and server progress bars on the website to animate smoothly and update constantly without freezing the React app.

---

---

## 🔍 Deep Dive: How the Cloud Code Works

This simulator isn't just a UI—it's executing real Amazon SDK commands. Here is a look under the hood at the core files managing the architecture:

### 1. The Internal WebSockets (`backend/src/socket/index.js`)
Because REST APIs are too slow for real-time dashboards, we attached `socket.io` directly to the Express server. The backend runs a `setInterval` timer that pushes the precise metric array (e.g., how many requests each node handled) every 500 milliseconds, completely bypassing the need for the frontend to ask for it.

### 2. The External AWS APIs (`backend/src/aws/ec2Manager.js`)
The application directly imports the modern V3 AWS SDK to execute complex infrastructure deployment simply by running native javascript functions:

```javascript
// 1. Import the specific API client from AWS
import { EC2Client, RunInstancesCommand } from '@aws-sdk/client-ec2';

// 2. Create the API connection using your secrets
const client = new EC2Client({ 
   region: 'us-east-1', 
   credentials: { accessKeyId: '...', secretAccessKey: '...' }
});

// 3. Use the API to tell AWS to boot up a virtual machine!
await client.send(new RunInstancesCommand({
  ImageId: 'ami-0c02fb55956c7d316', // The OS Image
  InstanceType: 't3.micro',         // The physical hardware size
}));
```

---

## 📡 API Reference

All endpoints are prefixed with `/api`.

| Method | Endpoint | Request Body | Description |
|--------|----------|-------------|-------------|
| `POST` | `/provision` | — | Interacts with AWS SDK to boot EC2 servers and build the Load Balancer |
| `POST` | `/start-simulation` | `{ requestRate: 5, algorithm: "roundRobin" }` | Starts generating HTTP traffic against AWS |
| `POST` | `/stop-simulation` | — | Stops traffic and forces a log to DynamoDB |
| `POST` | `/set-algorithm` | `{ algorithm: "leastConnections" }` | Swaps the AWS ALB routing algorithm dynamically |
| `POST` | `/set-rate` | `{ rate: 20 }` | Changes the botnet request rate mid-run |
| `GET` | `/get-metrics` | — | Full snapshot of all metrics |
| `GET` | `/servers-status` | — | Gets the status of the physical backend nodes |
| `POST` | `/trigger-failure` | — | Instructs a node to return 503 errors (Chaos Engineering) |
| `POST` | `/recover-server` | `{ serverId: "..." }` | Tells a crashed node to start returning 200 OK again |
| `POST` | `/recover-all` | — | Recovers all downed servers |
| `POST` | `/add-server` | — | Simulates Auto-scaling by provisioning another node |
| `POST` | `/reset` | — | Full reset to initial metric state |
| `GET` | `/algorithm-stats` | — | Fetches comparison data for the current session |
| `GET` | `/cloud-logs` | — | Fetches historical session logs directly from DynamoDB |

### WebSocket Events

| Event | Direction | Data | Description |
|-------|-----------|------|-------------|
| `infra-status` | Server → Client | Node stats | Live AWS EC2 node connection load and CPU usage |
| `real-metrics` | Server → Client | Metrics Blob| Total requests, latencies, and global stats (every 500ms) |
| `request-metrics` | Client → Server | — | Forces a manual request for an immediate snapshot |

---

## 📁 Project Structure

```text
cis hackathon/
├── README.md                    ← This file
├── about.txt                    ← Extended internal project documentation
│
├── backend/
│   ├── package.json             ← Dependencies: express, socket.io, aws-sdk
│   ├── .env                     ← AWS credentials (NEVER commit this)
│   └── src/
│       ├── index.js             ← Entry point: Express API + Socket.io server
│       │
│       ├── simulation/
│       │   ├── trafficGenerator.js     ← Botnet logic for firing HTTP traffic at AWS
│       │   └── RealModeEngine.js       ← Primary orchestrator for the simulation
│       │
│       ├── routes/
│       │   └── api.js                  ← All Express REST endpoints
│       │
│       ├── socket/
│       │   └── socketHandler.js        ← WebSockets broadcasting logic
│       │
│       └── aws/
│           ├── ec2Manager.js           ← Script provisioning EC2s, Security Groups, ALB, Target Groups
│           └── dynamoClient.js         ← DynamoDB table configuration and queries
│
└── frontend/
    ├── package.json             ← Dependencies: react, recharts, socket.io-client
    ├── vite.config.js           
    ├── tailwind.config.js       
    └── src/
        ├── App.jsx              ← React Router endpoints
        ├── index.css            ← Global dark theme, glassmorphics, Tailwind utilities
        │
        ├── components/
        │   ├── MetricsCards.jsx        ← 4 summary KPI cards for health/latency
        │   ├── ServerCard.jsx          ← Individual AWS node status card UI
        │   ├── SimulationControls.jsx  ← Sidebar controls for rate, algorithm, provisioning
        │   ├── TrafficLineChart.jsx    ← React-Recharts RPS area chart
        │   ├── DistributionPieChart.jsx← React-Recharts request distribution donut
        │   └── ComparisonTable.jsx     ← Visual algorithm comparison matrix
        │
        └── pages/
            ├── Dashboard.jsx    ← Page 1: Main AWS simulation grid and charts
            └── Comparison.jsx   ← Page 2: Analytics & historical DynamoDB logs
```

---

## 🚀 How to Run

### 1. Configure AWS Credentials
Before running the application, you must provide your AWS credentials. Create a `.env` file inside the `backend/` directory and add your keys:

```text
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_REGION=us-east-1
```
> **Note:** These credentials must belong to an IAM user with active permissions to manage EC2, ELB, and DynamoDB.

### 2. Start the Backend
   ```powershell
   cd backend
   npm install
   npm run dev
   ```

### 3. Start the Frontend
   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

### 4. Running Your First Simulation

1. **Boot the Servers:** Open your browser to `http://localhost:5173`. On the right-side control panel, click the **Provision Infrastructure** button. Wait ~30 seconds for the backend to securely boot your AWS physical EC2 instances and Application Load Balancer. Once they're ready, they'll appear online in your Server Grid.
2. **Start the Traffic:** Click the **Start Firing Traffic** button and drag your slider to roughly `15 req/s`. The animated UI will instantly light up as real asynchronous requests bombard the AWS architecture.
3. **Visualizing Algorithm Differences:**
    - By default, the system runs on **Round Robin**. Click **Trigger Node Failure** (or if testing lag, click *Slow Down*) on one of the servers. 
       - **What the Graphs Show (Round Robin):** The **Bottom Bar Chart** will show the slow node slamming into 100% capacity and glowing red. However, the **Distribution Donut Chart** will remain evenly sliced (~33% each)! This visually proves that Round Robin blindly continues sending massive amounts of traffic into the choking server regardless of its health.
    - Now, quickly click **Least Connections** on the right panel to swap the AWS routing rules mid-flight. Watch the graphs update in real-time!
       - **What the Graphs Show (Least Connections):** On the **Distribution Donut Chart**, the slice representing the dying server will visibly shrink down to practically 0%. Simultaneously, the slices for the remaining healthy servers will massively expand (e.g., approaching 50% each). The **Bottom Bar Chart** perfectly reflects this, showing the healthy nodes absorbing the load and sparing the lagging server!
