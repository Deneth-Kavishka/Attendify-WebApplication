// Device Status Monitor Service
// Automatically detects offline devices based on missed heartbeats

import { dbStorage } from './storage';

interface DeviceStatusChange {
  deviceId: string;
  location: string;
  status: 'online' | 'offline';
  lastHeartbeat: Date | null;
}

interface StatusCheckResult {
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  changedDevices: DeviceStatusChange[];
}

interface MonitorConfig {
  checkInterval?: number;
  offlineThreshold?: number;
}

class DeviceStatusMonitor {
  private checkInterval: number;
  private offlineThreshold: number;
  private intervalId: NodeJS.Timeout | null;
  private isRunning: boolean;
  private checkCount: number;

  constructor() {
    this.checkInterval = 60000; // Check every 60 seconds
    this.offlineThreshold = 120000; // Mark offline after 2 minutes of no heartbeat
    this.intervalId = null;
    this.isRunning = false;
    this.checkCount = 0;
  }

  start(): void {
    if (this.isRunning) {
      console.log('⚠️ Device Status Monitor is already running');
      return;
    }

    console.log('🔄 Starting Device Status Monitor...');
    console.log(`📊 Check interval: ${this.checkInterval/1000}s, Offline threshold: ${this.offlineThreshold/1000}s`);
    
    this.isRunning = true;
    this.intervalId = setInterval(() => {
      this.checkDeviceStatus();
    }, this.checkInterval);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isRunning = false;
      console.log('🛑 Device Status Monitor stopped');
    }
  }

  async checkDeviceStatus(): Promise<StatusCheckResult | null> {
    try {
      const now = new Date();
      const offlineThreshold = new Date(now.getTime() - this.offlineThreshold);
      
      // Get all devices
      const devices = await dbStorage.getAllHardwareDevices();
      
      let onlineCount = 0;
      let offlineCount = 0;
      const changedDevices: DeviceStatusChange[] = [];

      for (const device of devices) {
        const wasOnline = device.status === 'online';
        let shouldBeOnline = false;

        // Check if device has sent heartbeat recently
        if (device.lastHeartbeat) {
          const lastHeartbeat = new Date(device.lastHeartbeat);
          shouldBeOnline = lastHeartbeat > offlineThreshold;
        }

        // Update status if changed
        if (wasOnline && !shouldBeOnline) {
          // Device went offline
          await dbStorage.updateHardwareDevice(device.id, {
            status: 'offline',
            lastErrorMessage: 'Device appears to be offline - no recent heartbeat',
            lastErrorTime: now,
          });
          
          changedDevices.push({
            deviceId: device.deviceId,
            location: device.location,
            status: 'offline',
            lastHeartbeat: device.lastHeartbeat,
          });
          
          console.log(`📴 Device offline: ${device.deviceId} (${device.location})`);
          offlineCount++;
        } else if (!wasOnline && shouldBeOnline) {
          // Device came back online (this should be handled by heartbeat, but just in case)
          await dbStorage.updateHardwareDevice(device.id, {
            status: 'online',
            lastErrorMessage: null,
            lastErrorTime: null,
          });
          
          changedDevices.push({
            deviceId: device.deviceId,
            location: device.location,
            status: 'online',
            lastHeartbeat: device.lastHeartbeat,
          });
          
          console.log(`📶 Device online: ${device.deviceId} (${device.location})`);
          onlineCount++;
        } else {
          // No status change
          if (shouldBeOnline) onlineCount++;
          else offlineCount++;
        }
      }

      // Log summary every 5 minutes (5 check cycles)
      if (this.checkCount % 5 === 0) {
        console.log(`📊 Device Status: ${onlineCount} online, ${offlineCount} offline (${devices.length} total)`);
      }

      this.checkCount = (this.checkCount || 0) + 1;

      // Return status change information for broadcasting
      return {
        totalDevices: devices.length,
        onlineDevices: onlineCount,
        offlineDevices: offlineCount,
        changedDevices,
      };

    } catch (error) {
      console.error('❌ Error checking device status:', error);
      return null;
    }
  }

  // Manual trigger for immediate check
  async checkNow(): Promise<StatusCheckResult | null> {
    console.log('🔍 Manual device status check triggered');
    return await this.checkDeviceStatus();
  }

  // Get status of the monitor
  getStatus() {
    return {
      isRunning: this.isRunning,
      checkInterval: this.checkInterval,
      offlineThreshold: this.offlineThreshold,
      nextCheck: this.intervalId ? new Date(Date.now() + this.checkInterval) : null,
    };
  }

  // Update configuration
  configure(options: MonitorConfig = {}): void {
    if (options.checkInterval) {
      this.checkInterval = options.checkInterval;
    }
    if (options.offlineThreshold) {
      this.offlineThreshold = options.offlineThreshold;
    }
    
    // Restart if running to apply new configuration
    if (this.isRunning) {
      this.stop();
      this.start();
    }
    
    console.log(`⚙️ Device monitor configured: check=${this.checkInterval/1000}s, threshold=${this.offlineThreshold/1000}s`);
  }
}

// Export singleton instance
export const deviceStatusMonitor = new DeviceStatusMonitor();

// Auto-start the monitor
deviceStatusMonitor.start();

export default deviceStatusMonitor;
