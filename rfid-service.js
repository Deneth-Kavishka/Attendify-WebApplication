// RFID Hardware Service for Arduino/ESP32 Integration
const WebSocket = require("ws");
const SerialPort = require("serialport");
const Readline = require("@serialport/parser-readline");

class RFIDHardwareService {
  constructor() {
    this.wss = null;
    this.serialPort = null;
    this.parser = null;
    this.connectedClients = new Set();
    this.isReading = false;
  }

  // Initialize WebSocket server for RFID communication
  async startWebSocketServer(port = 8081) {
    try {
      this.wss = new WebSocket.Server({
        port,
        path: "/rfid",
      });

      this.wss.on("connection", (ws) => {
        console.log("RFID client connected");
        this.connectedClients.add(ws);

        ws.on("message", (message) => {
          try {
            const data = JSON.parse(message);
            this.handleClientMessage(data, ws);
          } catch (error) {
            console.error("Invalid message from client:", error);
          }
        });

        ws.on("close", () => {
          console.log("RFID client disconnected");
          this.connectedClients.delete(ws);
        });

        ws.on("error", (error) => {
          console.error("WebSocket error:", error);
          this.connectedClients.delete(ws);
        });

        // Send initial status
        ws.send(
          JSON.stringify({
            type: "status",
            connected: this.serialPort ? this.serialPort.isOpen : false,
            ports: this.getAvailablePorts(),
          })
        );
      });

      console.log(`RFID WebSocket server started on port ${port}`);
      return true;
    } catch (error) {
      console.error("Failed to start WebSocket server:", error);
      return false;
    }
  }

  // Handle messages from web clients
  handleClientMessage(data, ws) {
    switch (data.command) {
      case "start_scan":
        this.startScanning();
        break;
      case "stop_scan":
        this.stopScanning();
        break;
      case "connect_serial":
        this.connectSerial(data.port, data.baudRate || 9600);
        break;
      case "disconnect_serial":
        this.disconnectSerial();
        break;
      case "list_ports":
        this.sendAvailablePorts(ws);
        break;
    }
  }

  // Get available serial ports
  async getAvailablePorts() {
    try {
      const ports = await SerialPort.list();
      return ports
        .filter((port) => port.path) // Filter out invalid ports
        .map((port) => ({
          path: port.path,
          manufacturer: port.manufacturer,
          vendorId: port.vendorId,
          productId: port.productId,
        }));
    } catch (error) {
      console.error("Error listing ports:", error);
      return [];
    }
  }

  // Send available ports to client
  async sendAvailablePorts(ws) {
    const ports = await this.getAvailablePorts();
    ws.send(
      JSON.stringify({
        type: "ports_list",
        ports: ports,
      })
    );
  }

  // Connect to serial RFID reader (Arduino/ESP32)
  async connectSerial(portPath, baudRate = 9600) {
    try {
      if (this.serialPort && this.serialPort.isOpen) {
        await this.disconnectSerial();
      }

      // Auto-detect RFID reader port if not specified
      if (!portPath) {
        const ports = await this.getAvailablePorts();

        // Look for common Arduino/ESP32 devices
        const rfidPort = ports.find(
          (port) =>
            port.manufacturer &&
            (port.manufacturer.includes("Arduino") ||
              port.manufacturer.includes("Silicon Labs") ||
              port.manufacturer.includes("FTDI") ||
              port.vendorId === "1A86" || // CH340
              port.vendorId === "0403" || // FTDI
              port.vendorId === "10C4") // CP210x
        );

        if (rfidPort) {
          portPath = rfidPort.path;
          console.log(`Auto-detected RFID reader on: ${portPath}`);
        } else {
          throw new Error(
            "No RFID reader detected. Please connect your Arduino/ESP32."
          );
        }
      }

      this.serialPort = new SerialPort(portPath, {
        baudRate: baudRate,
        dataBits: 8,
        stopBits: 1,
        parity: "none",
      });

      this.parser = this.serialPort.pipe(new Readline({ delimiter: "\r\n" }));

      this.serialPort.on("open", () => {
        console.log(`RFID reader connected on ${portPath}`);
        this.broadcastStatus("connected", portPath);
      });

      this.serialPort.on("error", (error) => {
        console.error("Serial port error:", error);
        this.broadcastStatus("error", error.message);
      });

      this.serialPort.on("close", () => {
        console.log("RFID reader disconnected");
        this.broadcastStatus("disconnected");
      });

      // Handle RFID data from Arduino/ESP32
      this.parser.on("data", (data) => {
        this.handleRFIDData(data.trim());
      });

      return true;
    } catch (error) {
      console.error("Serial connection failed:", error);
      this.broadcastStatus("error", error.message);
      return false;
    }
  }

  // Disconnect from serial port
  async disconnectSerial() {
    return new Promise((resolve) => {
      if (this.serialPort && this.serialPort.isOpen) {
        this.serialPort.close((error) => {
          if (error) {
            console.error("Error closing serial port:", error);
          }
          this.serialPort = null;
          this.parser = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  // Handle RFID data from hardware
  handleRFIDData(data) {
    console.log("Raw RFID data:", data);

    // Parse different RFID formats
    let cardId = this.parseRFIDData(data);

    if (cardId) {
      console.log("RFID Card detected:", cardId);

      // Broadcast to all connected clients
      this.connectedClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(
            JSON.stringify({
              type: "rfid_read",
              cardId: cardId,
              rawData: data,
              timestamp: new Date().toISOString(),
            })
          );
        }
      });
    }
  }

  // Parse RFID data from different reader types
  parseRFIDData(data) {
    if (!data || data.length < 4) return null;

    // Remove common prefixes and clean data
    let cleaned = data.replace(/^(RFID|Card|ID|TAG)[:=\s]*/i, "").trim();

    // Remove non-alphanumeric characters
    cleaned = cleaned.replace(/[^a-fA-F0-9]/g, "").toUpperCase();

    // Validate length (typical RFID cards are 8-20 hex characters)
    if (
      cleaned.length >= 8 &&
      cleaned.length <= 20 &&
      /^[A-F0-9]+$/.test(cleaned)
    ) {
      return `RFID${cleaned}`;
    }

    // Handle decimal format (some readers output decimal)
    if (/^\d{8,}$/.test(cleaned)) {
      const hex = parseInt(cleaned).toString(16).toUpperCase().padStart(8, "0");
      return `RFID${hex}`;
    }

    return null;
  }

  // Start scanning mode
  startScanning() {
    if (!this.serialPort || !this.serialPort.isOpen) {
      this.broadcastStatus("error", "RFID reader not connected");
      return;
    }

    this.isReading = true;

    // Send command to Arduino/ESP32 to start scanning
    this.serialPort.write("START_SCAN\n");

    this.broadcastStatus("scanning", "RFID scanner active");
    console.log("RFID scanning started");
  }

  // Stop scanning mode
  stopScanning() {
    if (!this.serialPort || !this.serialPort.isOpen) {
      return;
    }

    this.isReading = false;

    // Send command to Arduino/ESP32 to stop scanning
    this.serialPort.write("STOP_SCAN\n");

    this.broadcastStatus("idle", "RFID scanner stopped");
    console.log("RFID scanning stopped");
  }

  // Broadcast status to all clients
  broadcastStatus(status, message = "") {
    const statusMessage = JSON.stringify({
      type: "status",
      status: status,
      message: message,
      timestamp: new Date().toISOString(),
    });

    this.connectedClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(statusMessage);
      }
    });
  }

  // Cleanup and shutdown
  async shutdown() {
    await this.disconnectSerial();

    if (this.wss) {
      this.wss.close();
    }

    console.log("RFID Hardware Service shutdown complete");
  }
}

// Start the service
async function startRFIDService() {
  const rfidService = new RFIDHardwareService();

  // Start WebSocket server
  const wsStarted = await rfidService.startWebSocketServer(8081);

  if (wsStarted) {
    console.log("RFID Hardware Service ready!");
    console.log("WebSocket: ws://localhost:8081/rfid");

    // Auto-connect to RFID reader if available
    setTimeout(async () => {
      await rfidService.connectSerial();
    }, 2000);
  }

  // Handle shutdown gracefully
  process.on("SIGINT", async () => {
    console.log("\nShutting down RFID service...");
    await rfidService.shutdown();
    process.exit(0);
  });

  return rfidService;
}

// Export for use as module or run standalone
if (require.main === module) {
  startRFIDService();
} else {
  module.exports = { RFIDHardwareService, startRFIDService };
}
