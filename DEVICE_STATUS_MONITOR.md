# Device Status Monitor - Automatic Offline Detection

## Overview

The Device Status Monitor automatically detects when ESP32 devices go offline and updates their status in the database. This solves the problem where devices that lose power don't automatically change their online status.

## How It Works

### 1. Background Monitoring Service

- **File**: `server/device-status-monitor.ts`
- **Check Interval**: 60 seconds (configurable)
- **Offline Threshold**: 2 minutes without heartbeat (configurable)
- **Auto-Start**: Automatically starts when the server boots

### 2. Detection Logic

```typescript
// Device is considered offline if:
lastHeartbeat < currentTime - offlineThreshold;
```

### 3. Status Updates

When a device is detected as offline:

- Database status changed to `'offline'`
- Error message set to "Device appears to be offline - no recent heartbeat"
- Console log: `📴 Device offline: ESP32_CAM_001 (Room A101)`

### 4. Automatic Recovery

When the device comes back online:

- ESP32 sends heartbeat to `/api/hardware/heartbeat`
- Server automatically sets status to `'online'`
- Error messages cleared

## API Endpoints

### Monitor Status

```http
GET /api/monitor/status
```

Returns monitor configuration and status.

### Manual Check

```http
POST /api/monitor/check
```

Triggers immediate device status check.

### Configuration

```http
POST /api/monitor/configure
{
  "checkInterval": 60000,    // milliseconds
  "offlineThreshold": 120000 // milliseconds
}
```

### Start/Stop Monitor

```http
POST /api/monitor/start
POST /api/monitor/stop
```

## Real-Time Updates

### Dashboard Integration

- Frontend dashboard automatically refreshes device list every 5 seconds
- Device status changes appear immediately in the admin panel
- Real-time statistics show accurate online/offline counts

### Console Monitoring

- **Device offline**: `📴 Device offline: ESP32_CAM_001 (Room A101)`
- **Device online**: `📶 Device online: ESP32_CAM_001 (Room A101)`
- **Status summary**: `📊 Device Status: 1 online, 0 offline (1 total)`

## ESP32 Integration

### Heartbeat System

The ESP32 sends heartbeats every 30 seconds to `/api/hardware/heartbeat`:

```json
{
  "deviceId": "ESP32_CAM_001",
  "status": "online",
  "timestamp": "2024-01-20T04:05:00.000Z",
  "ipAddress": "192.168.1.100",
  "macAddress": "30:AE:A4:07:0D:64",
  "signalStrength": -45,
  "freeMemory": 234567,
  "scanCount": 42,
  "recognitionCount": 5
}
```

### Power-Off Detection

- ESP32 stops sending heartbeats when powered off
- Monitor detects missing heartbeats after 2 minutes
- Device status automatically changes to offline
- No manual intervention required

## Database Schema

### Hardware Devices Table

```sql
status: 'online' | 'offline' | 'error'
last_heartbeat: timestamp
last_error_message: text (nullable)
last_error_time: timestamp (nullable)
```

## Testing Results

✅ **Automatic Offline Detection**: Device goes offline after 2 minutes without heartbeat
✅ **Automatic Online Recovery**: Device comes online when heartbeats resume
✅ **Manual Status Checks**: API endpoints work correctly
✅ **Real-time Dashboard**: Frontend updates automatically
✅ **Console Monitoring**: Clear logging of status changes
✅ **ESP32 Integration**: Heartbeat system working properly

## Configuration Options

| Setting           | Default    | Description                      |
| ----------------- | ---------- | -------------------------------- |
| Check Interval    | 60 seconds | How often to check device status |
| Offline Threshold | 2 minutes  | Time before marking offline      |
| Auto Start        | Yes        | Start monitor when server boots  |

## Log Examples

```
🔄 Starting Device Status Monitor...
📊 Check interval: 60s, Offline threshold: 120s
📴 Device offline: ESP32_CAM_001 (Room A101)
📊 Device Status: 0 online, 1 offline (1 total)
🔍 Manual device status check triggered
📊 Device Status: 1 online, 0 offline (1 total)
```

This system ensures that device status is always accurate, providing real-time monitoring without manual intervention.
