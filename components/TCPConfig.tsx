import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface WiFiOBDConfigProps {
  onConfigSaved: (config: { host: string; port: number }) => void;
  onClose: () => void;
}

export default function WiFiOBDConfig({ onConfigSaved, onClose }: WiFiOBDConfigProps) {
  const [host, setHost] = useState('192.168.0.10');
  const [port, setPort] = useState('35000');

  const saveConfig = async () => {
    // Validate inputs
    if (!host.trim()) {
      Alert.alert('Error', 'Please enter a valid host address');
      return;
    }

    const portNumber = parseInt(port);
    if (isNaN(portNumber) || portNumber < 1 || portNumber > 65535) {
      Alert.alert('Error', 'Please enter a valid port number (1-65535)');
      return;
    }

    // Validate IP address format (basic validation)
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(host.trim())) {
      Alert.alert('Error', 'Please enter a valid IP address (e.g., 192.168.1.100)');
      return;
    }

    const config = {
      host: host.trim(),
      port: portNumber,
    };

    try {
      // Save to AsyncStorage
      await AsyncStorage.setItem('WIFI_OBD_CONFIG', JSON.stringify(config));
      
      // Notify parent component
      onConfigSaved(config);
      
      Alert.alert('Success', 'WiFi OBD configuration saved successfully!');
    } catch (error) {
      console.error('Failed to save WiFi OBD config:', error);
      Alert.alert('Error', 'Failed to save configuration');
    }
  };

  const loadDefaultConfig = () => {
    setHost('192.168.0.10');
    setPort('35000');
  };

  const loadCommonWiFiOBDConfig = () => {
    setHost('192.168.0.10');
    setPort('35000');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>WiFi OBD Configuration</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.subtitle}>
        Configure connection to your WiFi OBD adapter
      </Text>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Host IP Address</Text>
          <TextInput
            style={styles.input}
            value={host}
            onChangeText={setHost}
            placeholder="192.168.0.10"
            keyboardType="numeric"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Port</Text>
          <TextInput
            style={styles.input}
            value={port}
            onChangeText={setPort}
            placeholder="35000"
            keyboardType="numeric"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      <View style={styles.presetButtons}>
        <TouchableOpacity style={styles.presetButton} onPress={loadDefaultConfig}>
          <Text style={styles.presetButtonText}>Default</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.presetButton} onPress={loadCommonWiFiOBDConfig}>
          <Text style={styles.presetButtonText}>Common WiFi OBD</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.helpSection}>
        <Text style={styles.helpTitle}>Setup Instructions:</Text>
        <Text style={styles.helpText}>1. Plug WiFi OBD adapter into your vehicle's OBD port</Text>
        <Text style={styles.helpText}>2. Turn on your vehicle (OBD port powers the adapter)</Text>
        <Text style={styles.helpText}>3. Connect your phone to the OBD adapter's WiFi network</Text>
        <Text style={styles.helpText}>4. Enter the adapter's IP address above (usually 192.168.0.10)</Text>
        <Text style={styles.helpText}>5. Common ports: 35000, 8080, or 23</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveButton} onPress={saveConfig}>
          <Text style={styles.saveButtonText}>Save & Connect</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
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
  form: {
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  presetButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  presetButton: {
    backgroundColor: '#e9ecef',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  presetButtonText: {
    fontSize: 14,
    color: '#495057',
    fontWeight: '500',
  },
  helpSection: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
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
    marginBottom: 4,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#6c757d',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});