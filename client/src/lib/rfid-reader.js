// RFID Reader Hardware Integration Service
import { useToast } from "@/hooks/use-toast";

class RFIDReaderService {
  constructor() {
    this.isConnected = false;
    this.port = null;
    this.reader = null;
    this.onCardRead = null;
    this.onError = null;
  }

  // Initialize connection to RFID reader hardware
  async connect() {
    try {
      // Check if Web Serial API is supported (Chrome/Edge)
      if ("serial" in navigator) {
        return await this.connectWebSerial();
      }
      // Fallback to WebSocket connection for external RFID service
      else {
        return await this.connectWebSocket();
      }
    } catch (error) {
      console.error("RFID Reader connection failed:", error);
      return false;
    }
  }

  // Web Serial API connection (for direct USB RFID readers)
  async connectWebSerial() {
    try {
      // Request port access
      this.port = await navigator.serial.requestPort({
        filters: [
          // Common RFID reader USB IDs
          { usbVendorId: 0x1a86, usbProductId: 0x7523 }, // CH340 based readers
          { usbVendorId: 0x0403, usbProductId: 0x6001 }, // FTDI based readers
          { usbVendorId: 0x10c4, usbProductId: 0xea60 }, // CP210x based readers
        ],
      });

      // Open port with RFID reader settings
      await this.port.open({
        baudRate: 9600,
        dataBits: 8,
        stopBits: 1,
        parity: "none",
        flowControl: "none",
      });

      this.isConnected = true;
      console.log("RFID Reader connected via USB");

      // Start reading from port
      this.startReading();
      return true;
    } catch (error) {
      console.error("Web Serial connection failed:", error);
      return false;
    }
  }

  // WebSocket connection (for network-connected RFID readers or local service)
  async connectWebSocket() {
    try {
      // Updated to use the main WebSocket server port 8080
      const wsUrl = process.env.RFID_WEBSOCKET_URL || "ws://localhost:8080";
      this.reader = new WebSocket(wsUrl);

      return new Promise((resolve) => {
        this.reader.onopen = () => {
          this.isConnected = true;
          console.log("RFID Reader connected via WebSocket");

          // Subscribe to RFID events
          this.reader.send(
            JSON.stringify({
              type: "subscribe_rfid",
              component: "rfid_reader_service",
            })
          );

          resolve(true);
        };

        this.reader.onerror = (error) => {
          console.error("WebSocket RFID connection failed:", error);
          resolve(false);
        };

        this.reader.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            // Handle different message types from the RFID service
            if (data.type === "rfid_card_detected" && data.cardId) {
              this.handleCardRead(data.cardId);
            } else if (data.type === "rfid_read" && data.cardId) {
              this.handleCardRead(data.cardId);
            } else if (data.type === "card_detected" && data.cardId) {
              this.handleCardRead(data.cardId);
            } else if (data.type === "welcome") {
              console.log("RFID Service:", data.message);
            } else if (data.type === "rfid_subscription_confirmed") {
              console.log("RFID subscription confirmed");
            }
          } catch (error) {
            console.error("RFID data parse error:", error);
          }
        };

        // Timeout after 5 seconds
        setTimeout(() => resolve(false), 5000);
      });
    } catch (error) {
      console.error("WebSocket connection failed:", error);
      return false;
    }
  }

  // Start reading from USB RFID reader
  async startReading() {
    if (!this.port || !this.isConnected) return;

    try {
      const reader = this.port.readable.getReader();
      let buffer = "";

      while (this.isConnected) {
        const { value, done } = await reader.read();
        if (done) break;

        // Convert bytes to string
        const text = new TextDecoder().decode(value);
        buffer += text;

        // Check for complete RFID card read (usually ends with \r\n)
        const lines = buffer.split("\r\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          const cardId = this.parseRFIDData(line.trim());
          if (cardId) {
            this.handleCardRead(cardId);
          }
        }
      }

      reader.releaseLock();
    } catch (error) {
      console.error("RFID reading error:", error);
      this.handleError("Reading error: " + error.message);
    }
  }

  // Parse RFID data based on reader format
  parseRFIDData(data) {
    if (!data) return null;

    // Remove non-alphanumeric characters and convert to uppercase
    const cleaned = data.replace(/[^a-fA-F0-9]/g, "").toUpperCase();

    // Check if it looks like a valid RFID (hex format, 8-20 characters)
    if (
      cleaned.length >= 8 &&
      cleaned.length <= 20 &&
      /^[A-F0-9]+$/.test(cleaned)
    ) {
      // Format as standard RFID card
      return `RFID${cleaned}`;
    }

    return null;
  }

  // Handle successful card read
  handleCardRead(cardId) {
    console.log("RFID Card Read:", cardId);
    if (this.onCardRead) {
      this.onCardRead(cardId);
    }
  }

  // Handle errors
  handleError(error) {
    console.error("RFID Error:", error);
    if (this.onError) {
      this.onError(error);
    }
  }

  // Start scanning for RFID cards
  async startScanning(onCardRead, onError) {
    this.onCardRead = onCardRead;
    this.onError = onError;

    if (!this.isConnected) {
      const connected = await this.connect();
      if (!connected) {
        onError(
          "Failed to connect to RFID reader. Please check hardware connection."
        );
        return false;
      }
    }

    // Send start command for WebSocket readers
    if (this.reader && this.reader.readyState === WebSocket.OPEN) {
      this.reader.send(JSON.stringify({ command: "start_scan" }));
    }

    return true;
  }

  // Stop scanning
  stopScanning() {
    this.onCardRead = null;
    this.onError = null;

    // Send stop command for WebSocket readers
    if (this.reader && this.reader.readyState === WebSocket.OPEN) {
      this.reader.send(JSON.stringify({ command: "stop_scan" }));
    }
  }

  // Disconnect from reader
  async disconnect() {
    this.isConnected = false;
    this.stopScanning();

    if (this.port) {
      try {
        await this.port.close();
      } catch (error) {
        console.error("Error closing serial port:", error);
      }
      this.port = null;
    }

    if (this.reader) {
      this.reader.close();
      this.reader = null;
    }
  }

  // Check reader status
  getStatus() {
    return {
      connected: this.isConnected,
      type: this.port ? "USB" : this.reader ? "WebSocket" : "None",
    };
  }
}

// Singleton instance
export const rfidReader = new RFIDReaderService();

// React hook for RFID functionality
export const useRFIDReader = () => {
  const { toast } = useToast();

  const scanCard = async () => {
    return new Promise((resolve, reject) => {
      const onCardRead = (cardId) => {
        toast({
          title: "RFID Card Detected",
          description: `Card ID: ${cardId}`,
        });
        resolve(cardId);
      };

      const onError = (error) => {
        toast({
          title: "RFID Scanner Error",
          description: error,
          variant: "destructive",
        });
        reject(new Error(error));
      };

      rfidReader.startScanning(onCardRead, onError).then((started) => {
        if (!started) {
          reject(new Error("Failed to start RFID scanning"));
        }
      });
    });
  };

  const stopScan = () => {
    rfidReader.stopScanning();
  };

  const getReaderStatus = () => {
    return rfidReader.getStatus();
  };

  return {
    scanCard,
    stopScan,
    getReaderStatus,
    isSupported: "serial" in navigator || "WebSocket" in window,
  };
};

export default RFIDReaderService;
