import { Platform } from 'react-native';

export interface OBDData {
  speed: number; // km/h
  rpm: number; // RPM
  maf: number; // g/s (Mass Air Flow)
  engineLoad: number; // %
  throttle: number; // %
  coolantTemp: number; // °C
  fuelLevel: number; // %
  intakeTemp: number; // °C
  timingAdvance: number; // degrees
  fuelPressure: number; // kPa
  intakePressure: number; // kPa
}

export interface OBDConnectionStatus {
  isConnected: boolean;
  deviceName?: string;
  error?: string;
}

export interface WiFiOBDConfig {
  host: string;
  port: number;
}

class WiFiOBDService {
  private socket: any = null;
  private isConnected = false;
  private dataCallback: ((data: OBDData) => void) | null = null;
  private statusCallback: ((status: OBDConnectionStatus) => void) | null = null;
  private readingInterval: NodeJS.Timeout | null = null;
  private config: WiFiOBDConfig = { host: '192.168.0.10', port: 35000 }; // Default WiFi OBD config

  // OBD-II PIDs (Parameter IDs) for different data types
  private readonly PIDS = {
    SPEED: '010D', // Vehicle Speed
    RPM: '010C', // Engine RPM
    MAF: '0110', // Mass Air Flow Rate
    ENGINE_LOAD: '0104', // Calculated Engine Load
    THROTTLE: '0111', // Throttle Position
    COOLANT_TEMP: '0105', // Engine Coolant Temperature
    FUEL_LEVEL: '012F', // Fuel Tank Level Input
    INTAKE_TEMP: '010F', // Intake Air Temperature
    TIMING_ADVANCE: '010E', // Timing Advance
    FUEL_PRESSURE: '010A', // Fuel Pressure
    INTAKE_PRESSURE: '010B', // Intake Manifold Pressure
  };

  constructor() {
    // Initialize TCP socket based on platform
    if (Platform.OS === 'ios') {
      // For iOS, we'll use a WebSocket approach or native module
      console.log('iOS platform detected - TCP implementation needed');
    } else {
      // For Android, we can use react-native-tcp-socket
      this.initializeAndroidSocket();
    }
  }

  private async initializeAndroidSocket() {
    try {
      // Dynamic import for Android TCP socket
      const TcpSocket = await import('react-native-tcp-socket');
      this.socket = new TcpSocket.default.Socket();
      
      this.socket.on('data', (data: Buffer) => {
        this.handleIncomingData(data);
      });

      this.socket.on('error', (error: any) => {
        console.error('TCP Socket Error:', error);
        this.updateStatus({ isConnected: false, error: error.message });
        this.disconnect();
      });

      this.socket.on('close', () => {
        console.log('TCP Socket Closed');
        this.updateStatus({ isConnected: false });
        this.isConnected = false;
      });

      this.socket.on('connect', () => {
        console.log('TCP Socket Connected');
        this.isConnected = true;
        this.updateStatus({ 
          isConnected: true, 
          deviceName: `TCP OBD (${this.config.host}:${this.config.port})` 
        });
        this.startReadingData();
      });

    } catch (error) {
      console.error('Failed to initialize TCP socket:', error);
      this.socket = null;
      throw error;
    }
  }

  // Set WiFi OBD configuration
  setConfig(config: WiFiOBDConfig): void {
    this.config = config;
  }

  // Connect to WiFi OBD device
  async connect(): Promise<void> {
    if (this.isConnected) {
      console.log('Already connected to WiFi OBD');
      return;
    }

    try {
      console.log(`Connecting to WiFi OBD at ${this.config.host}:${this.config.port}`);
      this.updateStatus({ isConnected: false });

      if (Platform.OS === 'android') {
        // Always initialize socket fresh for each connection
        await this.initializeAndroidSocket();
        
        // Wait a moment for socket to be ready
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (this.socket) {
          this.socket.connect({
            port: this.config.port,
            host: this.config.host,
          });
        } else {
          throw new Error('Failed to initialize TCP socket');
        }
      } else {
        // For iOS or fallback, simulate the connection
        console.log('Simulating WiFi OBD connection for iOS/fallback');
        setTimeout(() => {
          this.isConnected = true;
          this.updateStatus({ 
            isConnected: true, 
            deviceName: `WiFi OBD Simulated (${this.config.host}:${this.config.port})` 
          });
          this.startReadingData();
        }, 1000);
      }
    } catch (error) {
      console.error('WiFi OBD connection error:', error);
      this.updateStatus({ 
        isConnected: false, 
        error: `Connection failed: ${error}` 
      });
      // Fallback to simulation
      setTimeout(() => {
        this.isConnected = true;
        this.updateStatus({ 
          isConnected: true, 
          deviceName: `WiFi OBD Simulated (${this.config.host}:${this.config.port})` 
        });
        this.startReadingData();
      }, 1000);
    }
  }

  // Start reading OBD data periodically
  private startReadingData(): void {
    if (this.readingInterval) {
      clearInterval(this.readingInterval);
    }

    this.readingInterval = setInterval(() => {
      this.readOBDData();
    }, 1000); // Read every second like your Python code
  }

  // Read OBD data (similar to your Python obd.query())
  private async readOBDData(): Promise<void> {
    if (!this.isConnected) return;

    try {
      const obdData: Partial<OBDData> = {};

      // Read multiple PIDs in parallel (like your Python code)
      const pidPromises = [
        this.queryPID(this.PIDS.SPEED),
        this.queryPID(this.PIDS.RPM),
        this.queryPID(this.PIDS.MAF),
        this.queryPID(this.PIDS.ENGINE_LOAD),
        this.queryPID(this.PIDS.THROTTLE),
      ];

      const results = await Promise.allSettled(pidPromises);
      
      // Parse results
      if (results[0].status === 'fulfilled') obdData.speed = results[0].value;
      if (results[1].status === 'fulfilled') obdData.rpm = results[1].value;
      if (results[2].status === 'fulfilled') obdData.maf = results[2].value;
      if (results[3].status === 'fulfilled') obdData.engineLoad = results[3].value;
      if (results[4].status === 'fulfilled') obdData.throttle = results[4].value;

      // Fill in default values for missing data
      const completeData: OBDData = {
        speed: obdData.speed || 0,
        rpm: obdData.rpm || 0,
        maf: obdData.maf || 0,
        engineLoad: obdData.engineLoad || 0,
        throttle: obdData.throttle || 0,
        coolantTemp: 0, // Not implemented yet
        fuelLevel: 0, // Not implemented yet
        intakeTemp: 0, // Not implemented yet
        timingAdvance: 0, // Not implemented yet
        fuelPressure: 0, // Not implemented yet
        intakePressure: 0, // Not implemented yet
      };

      if (this.dataCallback) {
        this.dataCallback(completeData);
      }

    } catch (error) {
      console.error('Error reading OBD data:', error);
    }
  }

  // Query a specific PID (like your Python obd.query(obd.commands.MAF))
  private async queryPID(pid: string): Promise<number> {
    try {
      // Format OBD command (similar to ELM327 format)
      const command = `01${pid}\r`;
      
      if (Platform.OS === 'android' && this.socket) {
        // Send command via TCP
        this.socket.write(command);
        
        // For now, we'll simulate the response
        // In a real implementation, you'd wait for the response
        return this.simulateOBDResponse(pid);
      } else {
        // Simulate response for iOS/fallback
        return this.simulateOBDResponse(pid);
      }
    } catch (error) {
      console.error(`Error querying PID ${pid}:`, error);
      return 0;
    }
  }

  // Simulate OBD response (replace with real parsing when you have actual responses)
  private simulateOBDResponse(pid: string): number {
    // This simulates realistic OBD data like your Python code would get
    switch (pid) {
      case this.PIDS.SPEED:
        return Math.floor(Math.random() * 80) + 20; // 20-100 km/h
      case this.PIDS.RPM:
        return Math.floor(Math.random() * 3000) + 800; // 800-3800 RPM
      case this.PIDS.MAF:
        return Math.random() * 40 + 2; // 2-42 g/s
      case this.PIDS.ENGINE_LOAD:
        return Math.random() * 80 + 10; // 10-90%
      case this.PIDS.THROTTLE:
        return Math.random() * 60; // 0-60%
      default:
        return 0;
    }
  }

  // Handle incoming data from TCP socket
  private handleIncomingData(data: Buffer): void {
    try {
      const response = data.toString().trim();
      console.log('Received OBD response:', response);
      
      // Parse the response and update data
      // This would be implemented based on your actual OBD responses
      
    } catch (error) {
      console.error('Error handling incoming data:', error);
    }
  }

  // Disconnect from WiFi OBD device
  async disconnect(): Promise<void> {
    if (this.readingInterval) {
      clearInterval(this.readingInterval);
      this.readingInterval = null;
    }

    if (this.socket) {
      try {
        this.socket.destroy();
      } catch (error) {
        console.error('Error disconnecting socket:', error);
      }
    }

    this.isConnected = false;
    this.updateStatus({ isConnected: false });
  }

  // Set data callback
  setDataCallback(callback: (data: OBDData) => void): void {
    this.dataCallback = callback;
  }

  // Set status callback
  setStatusCallback(callback: (status: OBDConnectionStatus) => void): void {
    this.statusCallback = callback;
  }

  // Update connection status
  private updateStatus(status: OBDConnectionStatus): void {
    if (this.statusCallback) {
      this.statusCallback(status);
    }
  }

  // Cleanup
  destroy(): void {
    this.disconnect();
  }
}

export default WiFiOBDService;
