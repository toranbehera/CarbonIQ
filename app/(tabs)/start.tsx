// app/(tabs)/start.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import WiFiOBDConfig from '../../components/TCPConfig';
import EmissionsCalculator from '../../services/EmissionsCalculator';
import WiFiOBDService, { OBDConnectionStatus, OBDData } from '../../services/TCPOBDService';
import { i, init, id } from '@instantdb/react-native';

// Only import maps on native platforms
let MapView: any, Marker: any, Polyline: any, PROVIDER_GOOGLE: any;
if (Platform.OS !== 'web') {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
  Polyline = maps.Polyline;
  PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
}

type Coord = { latitude: number; longitude: number };
type Trip = { route: Coord[]; distance: string; emissions: string; timestamp: string };

const APP_ID = "d8681029-bc7b-4e69-886b-74815444c014";

const schema = i.schema({
  entities: {
    vehicles: i.entity({
      vehicleId: i.string(),
      name: i.string(),
      vin: i.string(),
      body: i.string(),
      fuel: i.string(),
      vehicleType: i.string(),
      engineType: i.string(),
      year: i.number(),
      trend: i.number(),
      ownerId: i.string()
    }),
    obd_metrics: i.entity({
      speed: i.number(),
      maf: i.number(),
      engineLoad: i.number(),
      rpm: i.number(),
      throttlePosition: i.number(),
    }),
  },
});

const db = init({ appId: APP_ID, schema });
const currentUserId = "USR001";

interface Car {
  id: string;
  vehicleId: string;
  name: string;
  vin: string;
  body: string;
  fuel: string;
  vehicleType: string;
  engineType: string;
  year: number;
  trend: number;
  ownerId: string;
}

// Emissions calculation based on fuel type
const getEmissionsFactor = (fuelType: string): number => {
  // CO₂ emission factors (kg CO₂ per liter of fuel)
  const factors: Record<string, number> = {
    'Gasoline': 2.31,    // kg CO₂ per liter
    'Petrol': 2.31,       // same as gasoline
    'Diesel': 2.68,       // kg CO₂ per liter
    'Electric': 0,         // 0 if using renewable energy
    'Hybrid': 1.55,       // average hybrid
  };
  return factors[fuelType] || 2.31; // default to gasoline
};

// Calculate emissions from MAF (Mass Air Flow) if available
const calculateEmissionsFromMAF = (maf: number, fuelType: string, timeElapsed: number): number => {
  // MAF is in g/s, time in seconds
  // Rough conversion: MAF -> fuel consumption rate
  // Air-fuel ratio is typically ~14.7:1 for gasoline, ~14.5:1 for diesel
  const airFuelRatio = fuelType.toLowerCase().includes('diesel') ? 14.5 : 14.7;
  
  // Convert MAF (g/s) to fuel mass (g/s)
  const fuelMassGs = maf / airFuelRatio; // grams per second of fuel
  
  // Convert to liters per second (assuming fuel density ~0.75 g/cm³ for gasoline)
  const fuelDensity = 0.75; // g/cm³ = kg/L
  const fuelMassKg = fuelMassGs / 1000; // kg/s
  const fuelVolumeLiters = fuelMassKg / fuelDensity; // L/s
  
  // Get emissions factor
  const emissionsFactor = getEmissionsFactor(fuelType);
  
  // Calculate CO₂ emissions: liters_per_second × emissions_factor × time
  return fuelVolumeLiters * emissionsFactor * timeElapsed; // kg CO₂
};

const { height: WINDOW_HEIGHT } = Dimensions.get('window');
const MAP_HEIGHT = Math.round(WINDOW_HEIGHT * 0.42); // map height fixed so panel is visible

export default function StartScreen() {
  const router = useRouter();

  const query = { vehicles: {} };
  const { data } = db.useQuery(query);

  const cars: any = data?.vehicles;

  // --- state ---
  const [selectedCar, setSelectedCar] = useState<Car | null>(cars[0] ?? null);
  const [location, setLocation] = useState<Coord | null>(null);
  const [route, setRoute] = useState<Coord[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [distance, setDistance] = useState<number>(0);
  const [emissions, setEmissions] = useState<number>(0);
  const [speed, setSpeed] = useState<number>(0);
  const [maf, setMaf] = useState<number>(0);
  const [rpm, setRpm] = useState<number>(0);
  const [engineLoad, setEngineLoad] = useState<number>(0);
  const [throttle, setThrottle] = useState<number>(0);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [carModalVisible, setCarModalVisible] = useState(false);
  const [obdEnabled, setObdEnabled] = useState<boolean>(false);
  const [obdConnected, setObdConnected] = useState<boolean>(false);
  const [obdDeviceName, setObdDeviceName] = useState<string>('');
  const [obdConnecting, setObdConnecting] = useState<boolean>(false);
  const [wifiConfigVisible, setWifiConfigVisible] = useState<boolean>(false);
  const [lastTrip, setLastTrip] = useState<Trip | null>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const telemetryRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wifiOBDServiceRef = useRef<WiFiOBDService | null>(null);
  const lastTickTimeRef = useRef<number>(Date.now() / 1000);

  // --- get permission & initial location ---
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission required', 'Location permission is required for tracking.');
          setLoadingLocation(false);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({});
        setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      } catch (e) {
        console.warn('location error', e);
      } finally {
        setLoadingLocation(false);
      }
    })();

    return () => {
      // cleanup
      if (watchRef.current?.remove) watchRef.current.remove();
      if (telemetryRef.current) clearInterval(telemetryRef.current);
      if (wifiOBDServiceRef.current) {
        wifiOBDServiceRef.current.disconnect();
        wifiOBDServiceRef.current.destroy();
      }
    };
  }, []);

  // --- Emissions calculation from OBD data when tracking and OBD connected ---
  useEffect(() => {
    if (!isTracking) return;

    const currentTime = Date.now() / 1000;
    const dt_s = currentTime - lastTickTimeRef.current;
    lastTickTimeRef.current = currentTime;

    // Only use emissions calculator when OBD is connected and we have real data
    if (obdConnected && maf > 0 && speed > 0) {
      const outputs = EmissionsCalculator.ingestTick({
        dt_s,
        speed_mps: speed / 3.6, // km/h to m/s
        maf_gps: maf,
      });

      // Update emissions and distance from the calculator
      setEmissions(outputs.total_co2_g / 1000); // convert g to kg
      setDistance(outputs.distance_km);
    }
    // When OBD not connected, emissions remain at 0 (no fake data)
  }, [isTracking, obdConnected, maf, speed]);

  // haversine distance (km)
  const toRad = (v: number) => (v * Math.PI) / 180;
  const haversine = (c1: Coord, c2: Coord) => {
    const R = 6371;
    const dLat = toRad(c2.latitude - c1.latitude);
    const dLon = toRad(c2.longitude - c1.longitude);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(c1.latitude)) * Math.cos(toRad(c2.latitude)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // WiFi OBD connection functions
  const initializeWiFiOBDService = () => {
    if (!wifiOBDServiceRef.current) {
      wifiOBDServiceRef.current = new WiFiOBDService();
      
      // Set up WiFi OBD data callback
      wifiOBDServiceRef.current.setDataCallback((data: OBDData) => {
        setSpeed(data.speed);
        setRpm(data.rpm);
        setMaf(data.maf);
        setEngineLoad(data.engineLoad);
        setThrottle(data.throttle);
      });

      // Set up WiFi OBD status callback
      wifiOBDServiceRef.current.setStatusCallback((status: OBDConnectionStatus) => {
        setObdConnected(status.isConnected);
        setObdDeviceName(status.deviceName || '');
        setObdConnecting(false);
        
        if (status.error) {
          Alert.alert('WiFi OBD Connection Error', status.error);
        }
      });
    }
  };

  const toggleOBDConnection = async () => {
    if (!obdEnabled) {
      // Show WiFi OBD configuration modal
      setWifiConfigVisible(true);
    } else {
      // Disable WiFi OBD
      await wifiOBDServiceRef.current?.disconnect();
      setObdConnected(false);
      setObdDeviceName('');
      setObdEnabled(false);
    }
  };

  const handleWiFiConfigSaved = async (config: { host: string; port: number }) => {
    setWifiConfigVisible(false);
    initializeWiFiOBDService();
    setObdConnecting(true);
    setObdEnabled(true);
    
    // Set config and connect
    try {
      wifiOBDServiceRef.current?.setConfig(config);
      await wifiOBDServiceRef.current?.connect();
    } catch (error) {
      console.error('Failed to connect to WiFi OBD:', error);
      Alert.alert('Connection Failed', 'Could not connect to WiFi OBD adapter');
      setObdConnecting(false);
      setObdEnabled(false);
    }
  };

  // start recording
  const startTrip = async () => {
    if (!selectedCar) {
      Alert.alert('Select car', 'Please choose a car before starting a journey.');
      return;
    }

    // Reset emissions calculator for new trip
    EmissionsCalculator.reset();
    lastTickTimeRef.current = Date.now() / 1000;
    
    setIsTracking(true);
    setRoute([]);
    setDistance(0);
    setEmissions(0);
    setSpeed(0);
    setRpm(0);
    setMaf(0);
    setEngineLoad(0);
    setThrottle(0);

    // telemetry simulation updates once per second (only if OBD not connected)
    if (!obdConnected) {
      telemetryRef.current = setInterval(async () => {
        // speed between 20 - 80 km/h with small random variation
        setSpeed((s) => Math.max(0, +(s + (Math.random() - 0.45) * 3).toFixed(1) || 30));
        // rpm roughly linked to speed
        setRpm((r) => Math.round(800 + (Math.random() * 3000)));
        // MAF random plausible value
        setMaf((m) => +(2 + Math.random() * 40).toFixed(2));
        setEngineLoad((el) => +(10 + Math.random() * 80).toFixed(1));
        setThrottle((t) => +(Math.max(0, Math.random() * 60)).toFixed(1));

        const data = {
          speed: Math.max(0, +(speed + (Math.random() - 0.45) * 3).toFixed(1) || 30),
          rpm: Math.round(800 + Math.random() * 3000),
          maf: +(2 + Math.random() * 40).toFixed(2),
          engineLoad: +(10 + Math.random() * 80).toFixed(1),
          throttlePosition: +(Math.max(0, Math.random() * 60)).toFixed(1),
        };

        try {
          await db.transact(db.tx.obd_metrics[id()].create(data));
        } catch (err) {
          console.log(err);
        }
      }, 1000);
    }

    // watch position
    try {
      watchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 2 },
        (loc) => {
          const coords: Coord = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          setRoute((prev) => {
            if (prev.length > 0) {
              const last = prev[prev.length - 1];
              const d = haversine(last, coords);
              setDistance((prevDist) => +(prevDist + d).toFixed(3));
              // emissions only from distance when OBD not connected (otherwise from EmissionsCalculator)
              if (!obdConnected) {
                setEmissions((prevEm) => +(prevEm + d * 0.18).toFixed(3));
              }
            }
            return [...prev, coords];
          });
          setLocation(coords);
        }
      );
    } catch (err) {
      console.warn('watchPosition error', err);
      Alert.alert('Error', 'Unable to start location tracking.');
      // stop telemetry if location can't run
      if (telemetryRef.current) clearInterval(telemetryRef.current);
      setIsTracking(false);
    }
  };

  // stop recording and save trip
  const stopTrip = async () => {
    if (watchRef.current?.remove) watchRef.current.remove();
    if (telemetryRef.current) clearInterval(telemetryRef.current);
    setIsTracking(false);

    const trip: Trip = {
      route,
      distance: distance.toFixed(2),
      emissions: emissions.toFixed(2),
      timestamp: new Date().toISOString(),
    };

    try {
      const raw = await AsyncStorage.getItem('TRIPS');
      const existing: Trip[] = raw ? JSON.parse(raw) : [];
      const updated = [trip, ...existing];
      await AsyncStorage.setItem('TRIPS', JSON.stringify(updated));
      setLastTrip(trip);
      Alert.alert('Trip saved', `Distance: ${trip.distance} km\nCO₂: ${trip.emissions} kg`);
      // optional: auto open analytics (if available)
      // router.push('/analytics');
    } catch (e) {
      console.warn('save trip fail', e);
      Alert.alert('Error', 'Failed to save trip data locally.');
    }
  };

  // helper: render car item in modal
  const renderCarItem = ({ item }: { item: Car }) => (
    <TouchableOpacity
      style={styles.carItem}
      onPress={() => {
        setSelectedCar(item);
        setCarModalVisible(false);
      }}
    >
      <Text style={styles.carItemTitle}>{item.name}</Text>
      {/* <Text style={styles.carItemSub}>{item.model}</Text> */}
    </TouchableOpacity>
  );

  if (loadingLocation) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 10 }}>Getting location permission...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {Platform.OS !== 'web' && MapView ? (
        <MapView
          provider={PROVIDER_GOOGLE}
          style={[styles.map, { height: MAP_HEIGHT }]}
          initialRegion={{
            latitude: location?.latitude || -37.6822,
            longitude: location?.longitude || 144.5808,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }}
        >
          {route.map((c, i) => (
            <Marker key={i} coordinate={c} />
          ))}
          {route.length > 1 && <Polyline coordinates={route} strokeWidth={4} strokeColor="#2a9d8f" />}
        </MapView>
      ) : (
        <View style={[styles.map, { height: MAP_HEIGHT, backgroundColor: '#e0e0e0', justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={{ color: '#666' }}>Map not available</Text>
        </View>
      )}

      <ScrollView style={styles.panel}>
        {/* Car select row */}
        <View style={styles.row}>
          <View>
            <Text style={styles.label}>Car</Text>
            <TouchableOpacity
              style={styles.selectBox}
              onPress={() => setCarModalVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.selectText}>{selectedCar ? selectedCar.name : 'Select car'}</Text>
              {/* <Text style={styles.selectSub}>{selectedCar ? selectedCar.model : ''}</Text> */}
            </TouchableOpacity>
          </View>

          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.label}>WiFi OBD</Text>
            <TouchableOpacity
              style={[
                styles.obdBtn, 
                obdConnecting ? styles.obdConnecting : 
                obdConnected ? styles.obdOn : styles.obdOff
              ]}
              onPress={toggleOBDConnection}
              disabled={obdConnecting}
            >
              <Text style={styles.obdBtnText}>
                {obdConnecting ? 'Connecting...' : 
                 obdConnected ? 'Connected' : 'Off'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Car details */}
        {selectedCar && (
          <View style={styles.infoBox}>
            <Text style={styles.infoLine}>
              <Text style={styles.infoLabel}>Model: </Text>
              {selectedCar.name}
            </Text>
            <Text style={styles.infoLine}>
              <Text style={styles.infoLabel}>Fuel type: </Text>
              {selectedCar.fuel}
            </Text>
            <Text style={styles.infoLine}>
              <Text style={styles.infoLabel}>Engine: </Text>
              {selectedCar.engineType}
            </Text>
          </View>
        )}

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Distance</Text>
            <Text style={styles.statValue}>{distance.toFixed(2)} km</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>CO₂</Text>
            <Text style={styles.statValue}>{emissions.toFixed(3)} kg</Text>
          </View>
        </View>

        {/* Telemetry when recording */}
        {isTracking && (
          <View style={styles.telemetry}>
            <Text style={styles.teleTitle}>
              Live telemetry {obdConnected ? `(WiFi OBD: ${obdDeviceName})` : '(Simulated)'}
            </Text>
            <View style={styles.teleRow}>
              <Text style={styles.teleLabel}>Speed</Text>
              <Text style={styles.teleValue}>{speed.toFixed(1)} km/h</Text>
            </View>
            <View style={styles.teleRow}>
              <Text style={styles.teleLabel}>MAF</Text>
              <Text style={styles.teleValue}>{maf.toFixed(2)} g/s</Text>
            </View>
            <View style={styles.teleRow}>
              <Text style={styles.teleLabel}>Engine Load</Text>
              <Text style={styles.teleValue}>{engineLoad.toFixed(0)} %</Text>
            </View>
            <View style={styles.teleRow}>
              <Text style={styles.teleLabel}>RPM</Text>
              <Text style={styles.teleValue}>{rpm}</Text>
            </View>
            <View style={styles.teleRow}>
              <Text style={styles.teleLabel}>Throttle</Text>
              <Text style={styles.teleValue}>{throttle.toFixed(0)} %</Text>
            </View>
          </View>
        )}
        {/* here */}

        {/* Last trip summary */}
        {lastTrip && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Last Trip</Text>
            <Text>Distance: {lastTrip.distance} km</Text>
            <Text>CO₂: {lastTrip.emissions} kg</Text>
            <Text>Time: {new Date(lastTrip.timestamp).toLocaleString()}</Text>
          </View>
        )}
      </ScrollView>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          onPress={startTrip}
          disabled={isTracking}
          style={[styles.controlBtn, isTracking ? styles.disabledBtn : styles.startBtn]}
        >
          <Text style={styles.controlBtnText}>{isTracking ? 'Recording…' : 'Start Journey'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={stopTrip}
          disabled={!isTracking}
          style={[styles.controlBtn, !isTracking ? styles.disabledBtn : styles.stopBtn]}
        >
          <Text style={styles.controlBtnText}>Stop & Save</Text>
        </TouchableOpacity>
      </View>

      {/* Car selection modal */}
      <Modal visible={carModalVisible} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Car</Text>
            <FlatList
              data={cars}
              keyExtractor={(it) => it.id}
              renderItem={renderCarItem}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            />
            <TouchableOpacity style={styles.modalClose} onPress={() => setCarModalVisible(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* WiFi OBD Configuration Modal */}
      <Modal visible={wifiConfigVisible} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.wifiModalCard}>
            <WiFiOBDConfig
              onConfigSaved={handleWiFiConfigSaved}
              onClose={() => setWifiConfigVisible(false)}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f3f7' },
  map: { width: '100%' },
  panel: {
    paddingHorizontal: 14,
    paddingTop: 12,
    backgroundColor: 'transparent',
    maxHeight: '38%'
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  label: { fontSize: 14, color: '#333', marginBottom: 6, fontWeight: '600' },
  selectBox: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    width: 220,
    borderColor: '#ddd',
    borderWidth: 1,
  },
  selectText: { fontSize: 16, fontWeight: '700', color: '#111' },
  selectSub: { fontSize: 12, color: '#666' },
  obdBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, marginTop: 6 },
  obdOn: { backgroundColor: '#2ecc71' },
  obdOff: { backgroundColor: '#e0e0e0' },
  obdConnecting: { backgroundColor: '#f39c12' },
  obdBtnText: { color: '#fff', fontWeight: '700' },
  infoBox: { backgroundColor: '#fff', padding: 12, borderRadius: 10, marginBottom: 12, borderColor: '#eee', borderWidth: 1 },
  infoLine: { color: '#333', marginBottom: 6 },
  infoLabel: { fontWeight: '700' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: '#fff', padding: 12, borderRadius: 10, alignItems: 'center', marginHorizontal: 4, borderColor: '#eee', borderWidth: 1 },
  statLabel: { color: '#666', marginBottom: 6 },
  statValue: { fontSize: 18, fontWeight: '800' },
  telemetry: { backgroundColor: '#fff', padding: 12, borderRadius: 10, borderColor: '#eee', borderWidth: 1, marginBottom: 12 },
  teleTitle: { fontWeight: '800', marginBottom: 8 },
  teleRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  teleLabel: { color: '#666' },
  teleValue: { fontWeight: '700', color: '#0b7' },
  controls: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 10},
  controlBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginHorizontal: 6 },
  startBtn: { backgroundColor: '#111827' },
  stopBtn: { backgroundColor: '#c62828' },
  disabledBtn: { backgroundColor: '#bdbdbd' },
  controlBtnText: { color: '#fff', fontWeight: '800' },
  card: { backgroundColor: '#fff', padding: 12, borderRadius: 10, marginTop: 12, borderColor: '#eee', borderWidth: 1 },
  cardTitle: { fontWeight: '800', marginBottom: 6 },
  // modal styles
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, maxHeight: '70%' },
  wifiModalCard: { backgroundColor: '#fff', borderRadius: 12, maxHeight: '80%', width: '100%' },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12 },
  carItem: { paddingVertical: 12, paddingHorizontal: 8, borderRadius: 8, backgroundColor: '#fafafa' },
  carItemTitle: { fontWeight: '700' },
  carItemSub: { color: '#666', marginTop: 4 },
  modalClose: { marginTop: 12, alignItems: 'center' },
  modalCloseText: { color: '#0b3954', fontWeight: '700' },
});
