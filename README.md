# ⚡ Load Balancer Simulator with Strategy Comparison

> A full-stack, production-ready interactive web application that simulates how cloud load balancers work — visualizing Round Robin, Least Connections, and Weighted Round Robin algorithms in real-time using WebSockets, live charts, and AWS DynamoDB cloud logging.

---

## 📋 Table of Contents

1. [What Is This Project?](#-what-is-this-project)
2. [Live Output — What You See](#-live-output--what-you-see)
3. [Page 1 — Dashboard (Detailed Walkthrough)](#-page-1--dashboard)
4. [Page 2 — Comparison Page](#-page-2--comparison-page)
5. [Load Balancing Algorithms Explained](#-load-balancing-algorithms-explained)
6. [Real-Time System (WebSockets)](#-real-time-system-websockets)
7. [AWS DynamoDB Cloud Integration](#-aws-dynamodb-cloud-integration)
8. [Virtual Server System](#-virtual-server-system)
9. [Simulation Engine — How It Works](#-simulation-engine--how-it-works)
10. [All Features List](#-all-features-list)
11. [Tech Stack Explanation](#-tech-stack-explanation)
12. [API Reference](#-api-reference)
13. [Project Structure](#-project-structure)
14. [How to Run](#-how-to-run)

---

## 🎯 What Is This Project?

In real cloud infrastructure (like AWS, Google Cloud, Azure), when thousands of users send requests to your application at the same time, a **Load Balancer** sits in front of your servers and decides *which server* should handle each incoming request.

This project **simulates** that entire process in your browser:

- You create virtual traffic (incoming requests)
- The load balancer picks a server using your chosen algorithm
- You watch the servers get loaded up in real-time
- You compare how different strategies handle the same traffic

**Think of it like this:** Imagine a restaurant (your app) with 6 waiters (servers). The host at the door (load balancer) decides which waiter takes the next customer. Should they go in turns? Send customers to the least-busy waiter? This app shows you all three strategies in action.

---

## 🖥️ Live Output — What You See

When you open the app at `http://localhost:5173`, you see:

```
┌─────────────────────────────────────────────────────────┐
│  ⚡ LB Simulator    [Dashboard] [Comparison]   [● Live] │  ← Navbar
├─────────────────────────────────────────────────────────┤
│  REQ/S: 5   │  TOTAL: 1,240  │  6H·0O·0D  │  Avg: 2s  │  ← Metric Cards
├──────────────────────────────┬──────────────────────────┤
│  Virtual Servers Grid        │  Algorithm Selector      │
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

Everything **updates automatically every 500 milliseconds** — no page refresh needed.

---

## 📊 Page 1 — Dashboard

The Dashboard is the main page of the application. It contains 5 major sections:

---

### 🔷 Section 1 — Navigation Bar (Top)

The sticky top bar that stays visible as you scroll.

| Element | What It Does |
|---------|-------------|
| **⚡ LB Simulator logo** | Brand icon with a lightning bolt; the dot above it **glows green** when simulation is running |
| **Dashboard link** | Takes you to the main simulation view (active = highlighted) |
| **Comparison link** | Takes you to the algorithm comparison page |
| **● 90 reqs counter** | Shows the total request count for this session in real-time; appears only when simulation is running |
| **Round Robin / Least Conn. badge** | Shows the currently active algorithm |
| **📶 Live / Offline** | WebSocket connection status — "Live" = real-time updates working; "Offline" = lost connection to backend |

**Why the connection indicator matters:** This app uses WebSockets (persistent connection) instead of polling. If it shows "Offline," the charts stop updating. You can refresh the page to reconnect.

---

### 🔷 Section 2 — Metric Cards (4 Cards Row)

Four summary cards at the top of the Dashboard giving you a quick health snapshot.

#### Card 1 — REQ / SECOND
- **What it shows:** How many requests per second are currently being generated
- **When stopped:** Shows `0` with text "simulation stopped"
- **When running:** Shows the rate you set on the slider (e.g., `5`, `20`, `50`)
- **Why it matters:** Tells you the current traffic intensity hitting your virtual servers

#### Card 2 — TOTAL REQUESTS
- **What it shows:** The cumulative count of all requests sent during this session
- **Example:** If you run at 5 req/s for 60 seconds = `300` requests shown
- **Why it matters:** Helps you understand how much data the comparison table is based on

#### Card 3 — SERVERS (e.g., `6H · 0O · 0D`)
- **H = Healthy** — Servers working normally (green)
- **O = Overloaded** — Servers over 75% capacity (amber)
- **D = Down** — Servers that have been manually crashed (red)
- **Example:** `4H · 1O · 1D` means 4 healthy, 1 overloaded, 1 crashed
- **Why it matters:** Instant visual summary of your entire cluster health

#### Card 4 — AVG RESP. TIME
- **What it shows:** The average response time in milliseconds across all servers combined
- **When stopped:** Shows `—` (no data)
- **Example:** `2,240 ms` means requests are taking ~2.2 seconds on average
- **Why it matters:** A key performance metric — higher response time = overloaded servers slowing down

---

### 🔷 Section 3 — Virtual Server Grid

The grid of server cards is the heart of the Dashboard. Each card represents one **virtual server** in your simulated cloud cluster.

#### Server Names & Configuration

| Server | Max Connections | Weight | Purpose |
|--------|----------------|--------|---------|
| **Alpha** | 60 | 3 | High-capacity primary server |
| **Beta**  | 50 | 2 | Medium-capacity server |
| **Gamma** | 50 | 2 | Medium-capacity server |
| **Delta** | 40 | 1 | Low-capacity server |
| **Epsilon** | 40 | 1 | Low-capacity server |
| **Zeta** | 60 | 3 | High-capacity primary server |

The weight matters for the **Weighted Round Robin** algorithm — Alpha and Zeta get 3× more traffic than Delta and Epsilon.

#### What Each Server Card Shows

```
┌─────────────────────────────────────────┐
│ 🖥️ Alpha              [Healthy]          │  ← Name + Status Badge
│    srv-12649f5a                          │  ← Unique Server ID
│                                          │
│ Load                               45%  │  ← Load Percentage
│ ████████████░░░░░░░░░░░░░░░            │  ← Connection Load Bar
│ 27 / 60 connections                     │  ← Active vs Max Connections
│                                          │
│ ⚙ CPU    11%   ↗ Processed   1,240     │  ← CPU Usage & Total Requests Handled
│ ⏱ Resp.  2s    ↗ Weight      3         │  ← Avg Response Time & Server Weight
│                                          │
│ ⚙ CPU Usage                       11%  │  ← Separate CPU bar (color-coded)
│ ████░░░░░░░░░░░░░░░░░░░░░░░             │
└─────────────────────────────────────────┘
```

**Status Badge Colors:**
- 🟢 **Healthy** — Load < 75%. Server is accepting requests normally
- 🟡 **Overloaded** — Load ≥ 75%. Server is struggling; the card border glows amber; alert banner appears at top
- 🔴 **Down** — Manually crashed via "Trigger Random Failure". A "↻ Recover Server" button appears inside the card

**The Connection Load Bar:**
- Fills from left to right as connections increase
- **Blue gradient** → healthy
- **Amber gradient + glow** → overloaded (visually alarming)
- **Red** → down server

**The CPU Bar:**
- Simulated based on connection load + random noise
- **Purple/Indigo** → normal (0–65%)
- **Amber** → stressed (65–85%)
- **Red** → critical (85%+)

**Active Connections Display:**
- Shows `27 / 60 connections` meaning 27 requests currently being processed out of a max of 60
- When a request completes (after 0.8–5 seconds), this number decrements automatically

---

### 🔷 Section 4 — Right Panel (Controls + Charts)

The right column contains 4 stacked components:

#### Component A — Load Balancing Algorithm Selector

Three interactive option cards — click any to switch algorithm **instantly**, even mid-simulation:

```
┌─────────────────────────────────────────┐
│ Load Balancing Algorithm  [Switch anytime]│
├─────────────────────────────────────────┤
│ ↻ Round Robin           [ACTIVE]        │
│   Distributes requests sequentially...  │
├─────────────────────────────────────────┤
│ ⟂ Least Connections                     │
│   Routes to server with fewest...       │
├─────────────────────────────────────────┤
│ ⊗ Weighted RR                           │
│   Like Round Robin but respects...      │
└─────────────────────────────────────────┘
```

The **ACTIVE** badge highlights in the algorithm's color (blue/green/purple). When you switch, the backend immediately starts using the new algorithm for the next request — no reset needed.

#### Component B — Simulation Controls

```
┌─────────────────────────────────────────┐
│ Simulation Controls                     │
├─────────────────────────────────────────┤
│ [▶ Start Simulation]        [↺ Reset]   │
│ (turns into [⏹ Stop Simulation] when running)│
├─────────────────────────────────────────┤
│ REQUEST RATE                    5 req/s │
│ [1]══════○═══════════════════[50]       │
│      Low traffic                        │
├─────────────────────────────────────────┤
│ CHAOS ENGINEERING                       │
│ [⚠ Trigger Random Failure]              │
├─────────────────────────────────────────┤
│ AUTO-SCALING              6 / 12 servers│
│ [+ Add Server]  [− Remove]              │
├─────────────────────────────────────────┤
│ ● Simulation running · 1,240 reqs       │
└─────────────────────────────────────────┘
```

**Start / Stop Button:**
- **Start:** Begins request generation at the set rate and algorithm
- **Stop:** Halts generation immediately; logs the session to DynamoDB; all servers gradually drain their active connections
- **Reset (↺):** Stops simulation AND resets all servers, metrics, and request history to zero

**Request Rate Slider:**
- Range: **1 to 50 requests per second**
- Updates live while simulation is running — drag it up to stress-test the servers
- Color hint: `Low traffic` / `Medium traffic` / `⚠ High traffic` (at 35+)

**Trigger Random Failure (Chaos Engineering):**
- Randomly selects one *healthy* server and marks it as **Down**
- That server immediately stops receiving new requests
- The load balancer automatically re-routes traffic to remaining healthy servers
- You can recover it by clicking "↻ Recover Server" on its card

**Auto-Scaling:**
- **+ Add Server:** Adds a new server to the pool (Eta, Theta, Iota... up to 12 max)
- **− Remove:** Removes the last server from the pool (minimum 1 must remain)
- This simulates real cloud auto-scaling where you provision more resources under load

#### Component C — Traffic Line Chart (Area Chart)

```
RPS ↑
 50 │                ___
 35 │            ___/   \___
 20 │        ___/           \___
  5 │_______/                   \____
    └──────────────────────────────→ Time (last 30 seconds)
```

- **X-axis:** Time (last 30 data points = ~30 seconds of history)
- **Y-axis:** Requests per second
- **Blue gradient fill:** Makes the traffic trend visually clear
- **No animation:** Updates instantly every second for smooth live appearance
- When stopped, the chart retains historical data so you can analyze past traffic

#### Component D — Request Distribution Pie Chart (Donut)

```
        Alpha  30%
      ╱‾‾‾‾‾‾‾╲
    Beta        Zeta
    15%          28%
      ╲_______╱
    Gamma  Delta  Epsilon
     12%    8%     7%
```

- Shows what **percentage of total requests** each server handled
- Updates continuously every 500ms
- Color-coded per server (12 distinct colors)
- The **percentage labels** appear inside each slice (hidden if < 5% to avoid clutter)
- If a server has processed 0 requests, it doesn't appear in the chart
- Hover over a slice to see the server name, exact count, and percentage in a tooltip

---

### 🔷 Section 5 — Bar Chart (Server Load Distribution)

At the bottom of the left column:

```
Load %
100│
 75│           ████
 50│      ████ ████ ████
 25│ ████ ████ ████ ████ ████ ████
  0└──────────────────────────────
    Alpha Beta Gamma Delta Eps  Zeta
```

- **One bar per server** showing current load percentage (0–100%)
- **Blue bars** = healthy load
- **Amber bars** = overloaded server (>75%)
- **Red bars** = downed server (greyed out at low opacity)
- **Hover tooltip** shows: Load %, exact connections, and status
- Updates every 500ms via WebSocket — bars animate smoothly as load changes

---

## 📈 Page 2 — Comparison Page

Click **"Comparison"** in the navbar to access this page.

---

### Per-Algorithm Highlight Cards (3 Cards)

One card per algorithm showing a performance snapshot:

```
┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐
│ ↻ Round Robin        │ │ ⟂ Least Connections   │ │ ⊗ Weighted RR         │
│  Performance snapshot│ │  Performance snapshot │ │  Performance snapshot │
│                      │ │                      │ │                      │
│ Total Reqs │ Avg Resp│ │ Total Reqs │ Avg Resp│ │ Total Reqs │ Avg Resp │
│   1,240    │  2,100ms│ │    580     │  1,850ms│ │    320     │  2,400ms │
│                      │ │                      │ │                      │
│ Overloads  │ Fairness│ │ Overloads  │ Fairness│ │ Overloads  │ Fairness │
│     12     │   99%   │ │     3      │   99%   │ │     8      │   97%    │
│                      │ │                      │ │                      │
│ Request share ████░  │ │ Request share ██░░░  │ │ Request share █░░░░  │
└──────────────────────┘ └──────────────────────┘ └──────────────────────┘
```

**How to use:** Run the simulation, then switch between algorithms during the run. Each algorithm accumulates its own separate stats. Then visit this page to compare.

---

### Algorithm Comparison Table

The full detailed table with 6 columns:

| Algorithm | Total Requests | Avg Response Time | Overload Events | Fairness Score | Status |
|-----------|---------------|-------------------|----------------|----------------|--------|
| Round Robin | 1,240 | 2,100 ms | 12 | 99% | ● Active |
| Least Connections | 580 | 1,850 ms | 3 | 99% | Tested |
| Weighted RR | 0 | — | 0 | — | Not tested |

**Column Explanations:**
- **Total Requests:** How many requests were routed using this algorithm
- **Avg Response Time:** Average milliseconds from request arrival to completion
- **Overload Events:** How many times a server went from healthy → overloaded while this algorithm was active
- **Fairness Score:** `(1 - overload rate) × 100%` — higher is better, 100% = zero overload events
- **Status:** `● Active` = currently running; `Tested` = was used this session; `Not tested` = never selected

**📥 Export CSV button:** Downloads all comparison data as a `.csv` file you can open in Excel.

---

### AWS DynamoDB Session Logs Panel

```
☁ AWS DynamoDB — Session Logs           ✅ Connected (us-east-1)  [↺]
─────────────────────────────────────────────────────────────────────
  14:15:32   Round Robin    · 1,240 requests over this session
  13:58:10   Least Conn.    · 580 requests over this session
  13:42:05   Weighted RR    · 320 requests over this session
```

- Shows **session history** pulled live from your **AWS DynamoDB** table
- Green ✅ = DynamoDB is connected and logging
- Each row = one completed simulation session (stop triggers a log write)
- Click **↺** to refresh the list
- If not connected, shows "DynamoDB not connected — check AWS credentials in .env"

---

## 🔄 Load Balancing Algorithms Explained

### Algorithm 1 — Round Robin

**How it works:**
```
Requests:  1   2   3   4   5   6   7   8   9
Servers:  [A] [B] [C] [A] [B] [C] [A] [B] [C]
```
Goes through the healthy server list in a circular loop. Request 1 → Alpha, Request 2 → Beta, Request 3 → Gamma, Request 4 → Alpha again.

**Strengths:**
- Dead simple — O(1) per request
- Perfectly fair when all servers are equal
- No state needed beyond a counter

**Weaknesses:**
- Doesn't know which server is busiest
- If one request takes 5 seconds, that server still gets the next "turn"
- Poor for variable-length requests (some long, some short)

**Best for:** APIs where all requests take roughly the same time (e.g., simple GET endpoints).

---

### Algorithm 2 — Least Connections

**How it works:**
```
Server:    Alpha  Beta  Gamma  Delta
Active:      8     3      12     1
Pick: Delta (fewest connections = 1)
```
Scans all healthy servers, picks the one with the **lowest `activeConnections`** count right now.

**Strengths:**
- Naturally handles slow/fast requests — busy servers get fewer new requests
- Self-balancing under variable load
- Great for real-world traffic patterns

**Weaknesses:**
- Slightly more computation per request (must scan all servers)
- If all servers are at the same count, it picks the first one every time

**Best for:** APIs with variable response times, database queries, file uploads.

---

### Algorithm 3 — Weighted Round Robin

**How it works:**
```
Server:   Alpha(w=3)  Beta(w=2)  Delta(w=1)
List:     [A, A, A, B, B, D]  (built from weights)
Requests: 1→A, 2→A, 3→A, 4→B, 5→B, 6→D, 7→A, 8→A...
```
Builds an **expanded list** based on weights (Alpha weight=3 → appears 3 times in the list) and round-robins through it.

**Strengths:**
- Handles heterogeneous server pools (different CPU/RAM)
- Alpha and Zeta (weight=3) get 3× the traffic of Delta and Epsilon (weight=1)
- Predictable and deterministic

**Weaknesses:**
- Weights are static — can't adapt to runtime conditions
- You need to know server capacities upfront

**Best for:** Mixed clusters (e.g., one 8-core server + three 2-core servers).

---

## 📡 Real-Time System (WebSockets)

The app uses **Socket.io** for bidirectional real-time communication.

```
Browser                              Backend
   │                                    │
   │────── connect ──────────────────→ │
   │←───── current metrics snapshot ── │
   │                                    │
   │   (every 500ms while running)      │
   │←───── metrics-update ─────────── │  ← live data pushed to you
   │←───── metrics-update ─────────── │
   │←───── metrics-update ─────────── │
   │                                    │
   │────── request-metrics ─────────→ │  ← you can request manually too
   │←───── metrics-update ─────────── │
```

**Why WebSockets instead of HTTP polling?**
- HTTP polling: browser asks "any updates?" every second → 1 request/second of overhead
- WebSockets: backend *pushes* updates when they're ready → one persistent connection, instant delivery
- Result: lower latency, less bandwidth, real-time feel

**What gets pushed every 500ms:**
- All server states (connections, CPU, status, load%)
- Global metrics (totalRequests, rpsHistory)
- Per-algorithm stats
- Overload alert text

---

## ☁️ AWS DynamoDB Cloud Integration

The backend writes to a **DynamoDB table** (`LoadBalancerLogs`) in **us-east-1**.

### Table Schema

| Attribute | Type | Role | Example |
|-----------|------|------|---------|
| `sessionId` | String | **Partition Key** (Hash) | `"a3f5b2c1-..."` |
| `timestamp` | String | **Sort Key** (Range) | `"2026-03-31T14:15:32.000Z"` |
| `eventType` | String | Record type | `"SESSION_START"`, `"SESSION_END"`, `"METRICS_SNAPSHOT"` |
| `algorithm` | String | Active algorithm | `"roundRobin"` |
| `totalRequests` | Number | Request count | `1240` |
| `requestsPerSecond` | Number | Rate at snapshot | `5` |
| `overloadedCount` | Number | Overloaded servers | `1` |
| `metadata` | String | JSON blob of extra info | `"{\"serverCount\":6}"` |

### When Does It Write?

| Event | Trigger |
|-------|---------|
| `SESSION_START` | You click "Start Simulation" |
| `SESSION_END` | You click "Stop Simulation" |
| `METRICS_SNAPSHOT` | Every 30 seconds while simulation is running |

### Billing

Uses **PAY_PER_REQUEST** billing mode — no upfront provisioning costs. With 160 student credits and the free tier (25 WCU/RCU, 25 GB), this application costs effectively **$0** for development and demo use.

---

## 🖥️ Virtual Server System

Each virtual server is created by `ServerPool.js` with this structure:

```javascript
{
  id: "srv-12649f5a",          // Unique 8-char hex ID
  name: "Alpha",               // Human-readable name
  activeConnections: 0,        // Currently processing requests
  totalProcessed: 1240,        // Lifetime completed requests
  cpuUsage: 11,                // Simulated CPU % (0–99)
  maxCapacity: 60,             // Maximum concurrent connections
  weight: 3,                   // WRR weight
  status: "healthy",           // "healthy" | "overloaded" | "down"
  responseTime: 2244,          // Rolling avg response time (ms)
  avgResponseTime: 2100,       // Lifetime average
  responseSamples: 1240,       // Sample count for avg calculation
}
```

### How Status Is Determined

```
loadPercent = (activeConnections / maxCapacity) × 100

loadPercent ≥ 75%  →  status = "overloaded"
loadPercent < 75%  →  status = "healthy"
manually crashed   →  status = "down"  (stays until recovered)
```

### How CPU Is Simulated

```
cpuUsage = (loadPercent × 0.85) + random(−4 to +4)
           ↑                      ↑
     Proportional to load    Realistic noise
```

This makes the CPU feel realistic — it's correlated to connection load but not perfectly linear.

### Request Lifecycle

```
1. Request arrives
2. Server selected by algorithm
3. server.activeConnections++         (load goes up)
4. server.totalProcessed++            (counter goes up)
5. Status checked → possibly overloaded
6. Timer set for 800ms–5000ms (random)
7. Timer fires: server.activeConnections--   (request done)
8. Response time recorded
9. Status checked → possibly back to healthy
```

---

## ⚙️ Simulation Engine — How It Works

`SimulationEngine.js` is the core orchestrator. Here's the flow:

```
Start() called
     │
     ├──→ setInterval every 1 second:
     │       Loop N times (N = requestRate):
     │           selectServer() → uses active algorithm
     │           server.activeConnections++
     │           setTimeout(random 0.8–5s) → server.activeConnections--
     │           update stats
     │
     ├──→ setInterval every 500ms:
     │       emit("metrics-update", getMetrics()) → pushed to all browsers
     │
     └──→ setInterval every 30s:
             logMetricsSnapshot() → saved to DynamoDB
```

**Why separate intervals?**
- The 1-second interval controls *traffic generation* — aligns with "requests per second"
- The 500ms interval controls *UI updates* — makes charts feel fluid and responsive
- The 30-second interval controls *cloud logging* — balances detail vs. DynamoDB write cost

---

## ✨ All Features List

| Feature | Description |
|---------|-------------|
| **3 Algorithms** | Round Robin, Least Connections, Weighted Round Robin |
| **Algorithm switching** | Change algorithm live, mid-simulation, no restart needed |
| **Real-time WebSockets** | All data pushed every 500ms via Socket.io |
| **6 Virtual Servers** | Alpha through Zeta, each with unique capacity and weight |
| **Server Cards** | Per-server load bar, CPU bar, connection count, status badge |
| **Status Detection** | Automatic healthy → overloaded → healthy transitions |
| **Alert Banner** | Red/amber alert appears when any server is overloaded |
| **Request Rate Slider** | Adjustable 1–50 req/s, changes instantly |
| **Start / Stop / Reset** | Full simulation lifecycle control |
| **Failure Injection** | One-click random server crash (Chaos Engineering) |
| **Server Recovery** | Recover individual servers or all at once |
| **Auto-Scaling** | Add servers (up to 12) or remove them dynamically |
| **Live Bar Chart** | Per-server load % with color-coded bars |
| **Traffic Area Chart** | Requests per second over last 30 seconds |
| **Distribution Pie Chart** | Donut chart showing request share per server |
| **Metric Cards** | RPS, total requests, server health, avg response time |
| **Algorithm Comparison Table** | Side-by-side stats for all 3 algorithms |
| **Fairness Score** | Computed metric showing how evenly load was distributed |
| **CSV Export** | Download comparison data as spreadsheet |
| **AWS DynamoDB Logging** | Session events + metrics logged to cloud |
| **Cloud Logs Viewer** | See past session history pulled from DynamoDB |
| **WebSocket status** | Live/Offline indicator in navbar |
| **Dark Premium Theme** | Deep navy glassmorphism design |
| **Responsive Layout** | Works on wide screens and tablets |
| **Auto-reconnect** | WebSocket reconnects automatically if dropped |

---

## 🛠️ Tech Stack Explanation

### Frontend

| Technology | Version | Why Used |
|-----------|---------|---------|
| **React 18** | 18.3.1 | Component-based UI with efficient re-renders when socket data changes |
| **Vite** | 5.2.11 | Blazing-fast dev server + HMR; replaces slow Create React App |
| **Tailwind CSS** | 3.4.3 | Utility-first CSS for rapid consistent styling without writing class files |
| **Recharts** | 2.12.3 | React-native charting library; handles live data updates gracefully |
| **Socket.io-client** | 4.7.5 | WebSocket client that reconnects automatically, works with Vite proxy |
| **React Router v6** | 6.22.3 | Client-side routing between Dashboard and Comparison pages |
| **Lucide React** | 0.378.0 | Lightweight icon library (Activity, Server, AlertTriangle, etc.) |

### Backend

| Technology | Version | Why Used |
|-----------|---------|---------|
| **Node.js** | 18+ | JavaScript runtime; shares language with frontend |
| **Express** | 4.18.3 | Minimal HTTP framework for REST API endpoints |
| **Socket.io** | 4.7.5 | WebSocket server; integrates cleanly with Express |
| **AWS SDK v3** | 3.540.0 | Modular AWS SDK — only imports DynamoDB, lower bundle size |
| **UUID** | 9.0.1 | Generates unique session IDs and server IDs |
| **dotenv** | 16.4.5 | Loads `.env` credentials into `process.env` |
| **nodemon** | 3.1.0 | Auto-restarts server when you edit backend files during dev |

### Cloud

| Service | Usage |
|---------|-------|
| **AWS DynamoDB** | NoSQL table storing simulation session logs and metric snapshots |
| **Region: us-east-1** | US North Virginia — lowest latency for the demo |
| **Billing: PAY_PER_REQUEST** | No upfront provisioned throughput; scales automatically |

---

## 📡 API Reference

All endpoints are prefixed with `/api`.

| Method | Endpoint | Request Body | Description |
|--------|----------|-------------|-------------|
| `POST` | `/start-simulation` | `{ requestRate: 5, algorithm: "roundRobin" }` | Start generating traffic |
| `POST` | `/stop-simulation` | — | Stop simulation, log to DynamoDB |
| `POST` | `/set-algorithm` | `{ algorithm: "leastConnections" }` | Switch algorithm mid-run |
| `POST` | `/set-rate` | `{ rate: 20 }` | Change request rate mid-run |
| `GET` | `/get-metrics` | — | Full snapshot of all metrics |
| `GET` | `/servers-status` | — | Just the server array |
| `POST` | `/trigger-failure` | — | Crash a random healthy server |
| `POST` | `/recover-server` | `{ serverId: "srv-12649f5a" }` | Bring a specific server back |
| `POST` | `/recover-all` | — | Recover all downed servers |
| `POST` | `/add-server` | — | Add a new server (auto-scaling up) |
| `POST` | `/remove-server` | — | Remove last server (auto-scaling down) |
| `POST` | `/reset` | — | Full reset to initial state |
| `GET` | `/algorithm-stats` | — | Per-algorithm comparison data |
| `GET` | `/cloud-logs` | — | Fetch recent sessions from DynamoDB |
| `GET` | `/health` | — | Basic health check → `{ status: "ok" }` |

### WebSocket Events

| Event | Direction | Data |
|-------|-----------|------|
| `metrics-update` | Server → Client | Full metrics object (every 500ms) |
| `request-metrics` | Client → Server | Request an immediate snapshot |

---

## 📁 Project Structure

```
cis hackathon/
├── README.md                    ← This file
│
├── backend/
│   ├── package.json             ← Dependencies: express, socket.io, aws-sdk, uuid
│   ├── .env                     ← AWS credentials (NEVER commit this)
│   ├── .env.example             ← Safe template showing variable names only
│   └── src/
│       ├── index.js             ← Entry point: Express + Socket.io server setup
│       │
│       ├── algorithms/
│       │   ├── roundRobin.js           ← Stateful circular pointer
│       │   ├── leastConnections.js     ← Min-scan of activeConnections
│       │   └── weightedRoundRobin.js   ← Weight-expanded list + pointer
│       │
│       ├── simulation/
│       │   ├── ServerPool.js           ← Server factory + status logic
│       │   └── SimulationEngine.js     ← Core orchestrator singleton
│       │
│       ├── routes/
│       │   └── api.js                  ← All 15 REST endpoints
│       │
│       ├── socket/
│       │   └── socketHandler.js        ← Socket.io event registration
│       │
│       └── aws/
│           └── dynamoClient.js         ← DynamoDB table init + read/write
│
└── frontend/
    ├── package.json             ← Dependencies: react, recharts, socket.io-client
    ├── vite.config.js           ← Proxy /api and /socket.io to localhost:3001
    ├── tailwind.config.js       ← Custom colors, fonts, animations
    ├── postcss.config.js        ← Tailwind PostCSS pipeline
    ├── index.html               ← Root HTML with Google Fonts
    └── src/
        ├── main.jsx             ← ReactDOM.createRoot + BrowserRouter
        ├── App.jsx              ← Routes: / → Dashboard, /comparison → Comparison
        ├── index.css            ← Global dark theme, glass cards, animations
        │
        ├── hooks/
        │   └── useSocket.js     ← Socket.io connection + metrics state
        │
        ├── context/
        │   └── SimulationContext.jsx  ← Shared state + all API call functions
        │
        ├── components/
        │   ├── Navbar.jsx              ← Top nav with logo, links, status badges
        │   ├── AlertBanner.jsx         ← Overload warning strip
        │   ├── MetricsCards.jsx        ← 4 summary KPI cards
        │   ├── ServerCard.jsx          ← Individual server status card
        │   ├── ServerGrid.jsx          ← Responsive grid of ServerCards
        │   ├── AlgorithmSelector.jsx   ← 3-option algorithm picker
        │   ├── SimulationControls.jsx  ← Start/Stop/Slider/Failure/Scaling
        │   ├── LiveBarChart.jsx        ← Per-server load bar chart
        │   ├── TrafficLineChart.jsx    ← RPS over time area chart
        │   ├── DistributionPieChart.jsx← Request distribution donut
        │   └── ComparisonTable.jsx     ← Algorithm stats table + CSV export
        │
        └── pages/
            ├── Dashboard.jsx    ← Main simulation view (assembles components)
            └── Comparison.jsx   ← Algorithm comparison + DynamoDB logs
```

---

## 🚀 How to Run

### Requirements
- Node.js 18 or higher
- npm 9 or higher

### Step 1 — Start Backend

Open a terminal and run:
```powershell
cd "d:\2-2\cis\cis hackathon\backend"
npm run dev
```

You should see:
```
🚀 Load Balancer Simulator Backend
   → API:     http://localhost:3001/api
   → Health:  http://localhost:3001/health
   → Region:  us-east-1
   → Table:   LoadBalancerLogs

✅ DynamoDB table "LoadBalancerLogs" created in us-east-1
```

### Step 2 — Start Frontend

Open a **second** terminal and run:
```powershell
cd "d:\2-2\cis\cis hackathon\frontend"
npm run dev
```

You should see:
```
VITE v5.4.21  ready in 327 ms
  ➜  Local:   http://localhost:5173/
```

### Step 3 — Open the App

Go to **http://localhost:5173** in your browser.

### Step 4 — Run a Simulation

1. On the Dashboard, pick an algorithm (e.g., Round Robin)
2. Set the request rate slider (start at 5 req/s)
3. Click **▶ Start Simulation**
4. Watch the server cards update, bars fill, and charts animate
5. Drag the slider to 30+ req/s to see servers go Overloaded
6. Click **⚠ Trigger Random Failure** to crash a server
7. Switch to **Least Connections** — see how it re-distributes
8. Click **Comparison** in the navbar to see the stats table

---

## 🎨 UI Design Decisions

The app uses a **dark premium glassmorphism** design:

- **Background:** `#04080f` — deep dark navy, easy on eyes during demos
- **Cards:** Semi-transparent with backdrop blur — gives depth and modern feel
- **Borders:** Subtle `rgba(26,39,68,0.8)` — visible but not harsh
- **Primary accent:** Blue `#3b82f6` → Purple `#8b5cf6` gradient
- **Status colors:** Green `#10b981` / Amber `#f59e0b` / Red `#ef4444` — universally understood
- **Font:** Inter (Google Fonts) — premium, highly legible tech font
- **Monospace:** JetBrains Mono — for numbers, IDs, and stats (engineers love it)
- **Animations:** Subtle 200–400ms transitions everywhere; no jarring flashes

---

*Made for the CIS Hackathon — demonstrating cloud load balancing concepts with real AWS integration.*
