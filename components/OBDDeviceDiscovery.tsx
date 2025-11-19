import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { BleManager, Device } from 'react-native-ble-plx';

interface OBDDeviceDiscoveryProps {
  onDeviceSelected: (device: Device) => void;
  onClose: () => void;
}

interface ScannedDevice {
  id: string;
  name: string;
  rssi: number;
  device: Device;
}

export default function OBDDeviceDiscovery({ onDeviceSelected, onClose }: OBDDeviceDiscoveryProps) {
  const [devices, setDevices] = useState<ScannedDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [bleManager] = useState(new BleManager());

  useEffect(() => {
    return () => {
      bleManager.destroy();
    };
  }, []);

  const startScanning = async () => {
    setScanning(true);
    setDevices([]);

    try {
      await bleManager.startDeviceScan(null, null, (error, device) => {
        if (error) {
          console.error('Scan error:', error);
          Alert.alert('Scan Error', error.message);
          setScanning(false);
          return;
        }

        if (device && isOBDDevice(device)) {
          const scannedDevice: ScannedDevice = {
            id: device.id,
            name: device.name || 'Unknown Device',
            rssi: device.rssi || 0,
            device: device,
          };

          setDevices(prevDevices => {
            // Avoid duplicates
            const exists = prevDevices.find(d => d.id === device.id);
            if (exists) {
              return prevDevices.map(d => 
                d.id === device.id ? { ...d, rssi: device.rssi || 0 } : d
              );
            }
            return [...prevDevices, scannedDevice];
          });
        }
      });
    } catch (error) {
      console.error('Failed to start scanning:', error);
      Alert.alert('Error', 'Failed to start device scanning');
      setScanning(false);
    }
  };

  const stopScanning = () => {
    bleManager.stopDeviceScan();
    setScanning(false);
  };

  const isOBDDevice = (device: Device): boolean => {
    const name = device.name?.toLowerCase() || '';
    const obdKeywords = ['elm327', 'obd', 'obdii', 'obd2', 'car', 'auto', 'diagnostic', 'bluetooth'];
    return obdKeywords.some(keyword => name.includes(keyword));
  };

  const selectDevice = (device: ScannedDevice) => {
    stopScanning();
    onDeviceSelected(device.device);
  };

  const renderDevice = ({ item }: { item: ScannedDevice }) => (
    <TouchableOpacity
      style={styles.deviceItem}
      onPress={() => selectDevice(item)}
    >
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceName}>{item.name}</Text>
        <Text style={styles.deviceId}>ID: {item.id}</Text>
        <Text style={styles.deviceRssi}>Signal: {item.rssi} dBm</Text>
      </View>
      <TouchableOpacity
        style={styles.connectButton}
        onPress={() => selectDevice(item)}
      >
        <Text style={styles.connectButtonText}>Connect</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>OBD Device Discovery</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.subtitle}>
        Scan for nearby OBD-II Bluetooth adapters
      </Text>

      <View style={styles.controls}>
        {!scanning ? (
          <TouchableOpacity style={styles.scanButton} onPress={startScanning}>
            <Text style={styles.scanButtonText}>Start Scan</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.stopButton} onPress={stopScanning}>
            <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.stopButtonText}>Stop Scan</Text>
          </TouchableOpacity>
        )}
      </View>

      {devices.length === 0 && !scanning && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            No OBD devices found. Make sure your OBD adapter is powered on and in pairing mode.
          </Text>
        </View>
      )}

      {devices.length > 0 && (
        <FlatList
          data={devices}
          keyExtractor={(item) => item.id}
          renderItem={renderDevice}
          style={styles.deviceList}
          showsVerticalScrollIndicator={false}
        />
      )}

      <View style={styles.helpSection}>
        <Text style={styles.helpTitle}>Common OBD Adapter Names:</Text>
        <Text style={styles.helpText}>• ELM327</Text>
        <Text style={styles.helpText}>• OBD-II</Text>
        <Text style={styles.helpText}>• Car Diagnostic</Text>
        <Text style={styles.helpText}>• Auto Scanner</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#666',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  controls: {
    alignItems: 'center',
    marginBottom: 20,
  },
  scanButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  stopButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  stopButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  deviceList: {
    flex: 1,
    marginBottom: 20,
  },
  deviceItem: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  deviceId: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  deviceRssi: {
    fontSize: 12,
    color: '#666',
  },
  connectButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  helpSection: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
});
