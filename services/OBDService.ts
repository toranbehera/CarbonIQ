import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, Characteristic, Device } from 'react-native-ble-plx';

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

class OBDService {
  private bleManager: BleManager;
  private connectedDevice: Device | null = null;
  private isScanning = false;
  private dataCallback: ((data: OBDData) => void) | null = null;
  private statusCallback: ((status: OBDConnectionStatus) => void) | null = null;

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
    this.bleManager = new BleManager();
  }

  // Request Bluetooth permissions
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      
      return Object.values(granted).every(
        permission => permission === PermissionsAndroid.RESULTS.GRANTED
      );
    }
    return true; // iOS handles permissions automatically
  }

  // Start scanning for OBD devices
  async startScanning(): Promise<void> {
    if (this.isScanning) return;

    const hasPermissions = await this.requestPermissions();
    if (!hasPermissions) {
      this.updateStatus({ isConnected: false, error: 'Bluetooth permissions denied' });
      return;
    }

    this.isScanning = true;
    this.updateStatus({ isConnected: false });

    try {
      await this.bleManager.startDeviceScan(null, null, (error, device) => {
        if (error) {
          console.error('Scan error:', error);
          this.updateStatus({ isConnected: false, error: error.message });
          return;
        }

        if (device && this.isOBDDevice(device)) {
          console.log('Found OBD device:', device.name, device.id);
          this.stopScanning();
          this.connectToDevice(device);
        }
      });
    } catch (error) {
      console.error('Failed to start scanning:', error);
      this.updateStatus({ isConnected: false, error: 'Failed to start scanning' });
    }
  }

  // Stop scanning
  stopScanning(): void {
    if (this.isScanning) {
      this.bleManager.stopDeviceScan();
      this.isScanning = false;
    }
  }

  // Check if device is likely an OBD adapter
  private isOBDDevice(device: Device): boolean {
    const name = device.name?.toLowerCase() || '';
    const obdKeywords = ['elm327', 'obd', 'obdii', 'obd2', 'car', 'auto', 'diagnostic'];
    return obdKeywords.some(keyword => name.includes(keyword));
  }

  // Connect to OBD device (public method for external use)
  async connectToDevice(device: Device): Promise<void> {
    await this.connectToDeviceInternal(device);
  }

  // Connect to OBD device
  private async connectToDeviceInternal(device: Device): Promise<void> {
    try {
      console.log('Connecting to device:', device.name);
      this.updateStatus({ isConnected: false });

      const connectedDevice = await device.connect();
      await connectedDevice.discoverAllServicesAndCharacteristics();
      
      this.connectedDevice = connectedDevice;
      this.updateStatus({ 
        isConnected: true, 
        deviceName: device.name || 'OBD Device' 
      });

      // Start reading OBD data
      this.startReadingData();
      
    } catch (error) {
      console.error('Connection error:', error);
      this.updateStatus({ 
        isConnected: false, 
        error: `Connection failed: ${error}` 
      });
    }
  }

  // Start reading OBD data continuously
  private async startReadingData(): Promise<void> {
    if (!this.connectedDevice) return;

    try {
      // Find the characteristic for OBD communication
      const services = await this.connectedDevice.services();
      let obdCharacteristic: Characteristic | null = null;

      for (const service of services) {
        const characteristics = await service.characteristics();
        for (const char of characteristics) {
          // Look for a characteristic that can write/read (typical for OBD)
          if (char.isWritableWithResponse || char.isWritableWithoutResponse) {
            obdCharacteristic = char;
            break;
          }
        }
        if (obdCharacteristic) break;
      }

      if (!obdCharacteristic) {
        throw new Error('No suitable OBD characteristic found');
      }

      // Start periodic data reading
      this.readOBDDataPeriodically(obdCharacteristic);
      
    } catch (error) {
      console.error('Failed to start data reading:', error);
      this.updateStatus({ 
        isConnected: false, 
        error: 'Failed to start data reading' 
      });
    }
  }

  // Read OBD data periodically
  private async readOBDDataPeriodically(characteristic: Characteristic): Promise<void> {
    const readData = async () => {
      if (!this.connectedDevice) return;

      try {
        const obdData: Partial<OBDData> = {};

        // Read multiple PIDs in parallel
        const pidPromises = [
          this.readPID(characteristic, this.PIDS.SPEED),
          this.readPID(characteristic, this.PIDS.RPM),
          this.readPID(characteristic, this.PIDS.MAF),
          this.readPID(characteristic, this.PIDS.ENGINE_LOAD),
          this.readPID(characteristic, this.PIDS.THROTTLE),
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
    };

    // Read data every second
    setInterval(readData, 1000);
    readData(); // Initial read
  }

  // Read a specific PID from OBD
  private async readPID(characteristic: Characteristic, pid: string): Promise<number> {
    try {
      // Send OBD command
      const command = this.formatOBDCommand(pid);
      await characteristic.writeWithResponse(command);

      // Read response
      const response = await characteristic.read();
      const responseValue = response.value || '';
      const data = this.parseOBDResponse(responseValue, pid);
      
      return data;
    } catch (error) {
      console.error(`Error reading PID ${pid}:`, error);
      return 0;
    }
  }

  // Format OBD command
  private formatOBDCommand(pid: string): string {
    // ELM327 format: ATZ (reset), then send PID command
    return `01${pid}\r`;
  }

  // Parse OBD response
  private parseOBDResponse(response: string, pid: string): number {
    try {
      // Remove whitespace and convert to uppercase
      const cleanResponse = response.replace(/\s/g, '').toUpperCase();
      
      // Extract data bytes (skip header)
      const dataBytes = cleanResponse.substring(4); // Skip "41XX" header
      
      switch (pid) {
        case this.PIDS.SPEED:
          // Speed: A byte value in km/h
          return parseInt(dataBytes.substring(0, 2), 16);
          
        case this.PIDS.RPM:
          // RPM: (A*256 + B)/4
          const rpmA = parseInt(dataBytes.substring(0, 2), 16);
          const rpmB = parseInt(dataBytes.substring(2, 4), 16);
          return (rpmA * 256 + rpmB) / 4;
          
        case this.PIDS.MAF:
          // MAF: (A*256 + B)/100
          const mafA = parseInt(dataBytes.substring(0, 2), 16);
          const mafB = parseInt(dataBytes.substring(2, 4), 16);
          return (mafA * 256 + mafB) / 100;
          
        case this.PIDS.ENGINE_LOAD:
          // Engine Load: A*100/255
          const loadA = parseInt(dataBytes.substring(0, 2), 16);
          return (loadA * 100) / 255;
          
        case this.PIDS.THROTTLE:
          // Throttle Position: A*100/255
          const throttleA = parseInt(dataBytes.substring(0, 2), 16);
          return (throttleA * 100) / 255;
          
        default:
          return 0;
      }
    } catch (error) {
      console.error(`Error parsing PID ${pid}:`, error);
      return 0;
    }
  }

  // Disconnect from OBD device
  async disconnect(): Promise<void> {
    if (this.connectedDevice) {
      try {
        await this.connectedDevice.cancelConnection();
        this.connectedDevice = null;
        this.updateStatus({ isConnected: false });
      } catch (error) {
        console.error('Disconnect error:', error);
      }
    }
    this.stopScanning();
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
    this.bleManager.destroy();
  }
}

export default OBDService;
