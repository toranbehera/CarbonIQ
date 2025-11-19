import React, { useState, useEffect } from "react";
import {
  Pressable,
  StyleSheet,
  ScrollView,
  Text,
  View,
  ActivityIndicator,
  LayoutAnimation,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";

import { init, i, id } from "@instantdb/react-native";

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
  },
});

interface Vehicle {
  id: string;
  vehicleId: string;
  name: string;
  vin: string;
  body: string;
  fuel: string;
  vehicleType: string;
  year: number;
  trend: number;
  ownerId: string;
}

const db = init({ appId: APP_ID, schema });
const currentUserId = "USR001";

export default function VehiclesScreen() {
  const query = { vehicles: {} };
  const { data } = db.useQuery(query);
  const vehicles: Vehicle[] | undefined = data?.vehicles;

  const [vin, setVin] = useState("");
  const [vehicleInfo, setVehicleInfo] = useState<any | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [vinModalVisible, setVinModalVisible] = useState(false);

  let vinTimer: any = null;

  const resetVinState = () => {
    setVin("");
    setVehicleInfo(null);
    setError("");
    setLoading(false);
  };

  const closeModal = () => {
    resetVinState();
    setVinModalVisible(false);
  };

  // Auto-decode VIN when user enters enough characters
  useEffect(() => {
    if (vinTimer) clearTimeout(vinTimer);

    const cleanVin = vin.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

    if (cleanVin.length >= 11) {
      vinTimer = setTimeout(() => decodeVin(cleanVin), 500);
    } else {
      setVehicleInfo(null);
      setError("");
    }
  }, [vin]);

  const decodeVin = async (cleanVin: string) => {
    setError("");
    setLoading(true);

    try {
      const res = await fetch(
        `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${cleanVin}?format=json`
      );

      const json = await res.json();
      const r = json?.Results?.[0] || {};

      const info = {
        make: r.Make || "Unknown",
        model: r.Model || "Unknown",
        year: Number(r.ModelYear) || 0,
        body: r.BodyClass || "Unknown",
        vehicleType: r.VehicleType || "Unknown",
        engineType: r.DisplacementL || "Unknown",
        fuelTypePrimary: r.FuelTypePrimary || "Unknown",
      };

      if (info.make === "Unknown") {
        setVehicleInfo(null);
        setError("Could not decode VIN.");
      } else {
        setVehicleInfo(info);
      }
    } catch (e) {
      setVehicleInfo(null);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const generateRandomTrend = () => Math.floor(Math.random() * 10) + 1;

  const registerVehicle = async () => {
    if (!vehicleInfo || !vin) {
      setError("Please enter a valid VIN.");
      return;
    }

    const newVehicle = {
      vehicleId: Date.now().toString(),
      name: `${vehicleInfo.make} ${vehicleInfo.model}`,
      vin,
      body: vehicleInfo.body,
      fuel: vehicleInfo.fuelTypePrimary,
      vehicleType: vehicleInfo.vehicleType,
      engineType: vehicleInfo.engineType,
      year: vehicleInfo.year,
      trend: generateRandomTrend(),
      ownerId: currentUserId,
    };

    try {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      await db.transact(db.tx.vehicles[id()].create(newVehicle));
      closeModal();
    } catch (err) {
      setError("Failed to save vehicle.");
    }
  };

  return (
    <SafeAreaView style={styles.vehiclesPageContainer}>
      
      {/* Vehicle List */}
      <ScrollView style={styles.vehiclesContainer}>
        {vehicles?.map((v) => (
          <ThemedView style={styles.vehicleCard} key={v.id}>
            <ThemedText style={{ fontSize: 20, fontWeight: 500, color: '#111111' }}>
              {v.name}
            </ThemedText>

            <Pressable
              onPress={() => db.transact(db.tx.vehicles[v.id].delete())}
            >
              <IconSymbol size={28} name="trash" color="black" />
            </Pressable>
          </ThemedView>
        ))}
      </ScrollView>

      {/* Add Vehicle button */}
      <Pressable
        style={styles.addVehicleButton}
        onPress={() => setVinModalVisible(true)}
      >
        <IconSymbol size={28} name="plus" color="white" />
        <Text style={styles.addVehicleButtonText}>Add Vehicle</Text>
      </Pressable>

      {/* VIN Modal */}
      <Modal
        transparent
        visible={vinModalVisible}
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            style={styles.modalKeyboardWrapper}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <View style={styles.modalContent}>
              
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Vehicle by VIN</Text>
                <Pressable onPress={closeModal}>
                  <IconSymbol size={22} name="xmark" color="#6b7280" />
                </Pressable>
              </View>

              <Text style={styles.vinLabel}>VIN</Text>

              <TextInput
                placeholder="Enter VIN (e.g. 5YJ3E1EA7JF000316)"
                value={vin}
                onChangeText={(text) => setVin(text.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                style={styles.vinInput}
              />

              {loading && (
                <ActivityIndicator
                  size="small"
                  color="#111827"
                  style={{ marginTop: 10 }}
                />
              )}

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              {vehicleInfo && (
                <View style={styles.vehicleInfoPreview}>
                  <Text>Make: {vehicleInfo.make}</Text>
                  <Text>Model: {vehicleInfo.model}</Text>
                  <Text>Year: {vehicleInfo.year}</Text>
                  <Text>Body: {vehicleInfo.body}</Text>
                  <Text>Displacement: {vehicleInfo.engineType}</Text>
                  <Text>Fuel: {vehicleInfo.fuelTypePrimary}</Text>
                </View>
              )}

              <Pressable
                style={[
                  styles.saveVehicleButton,
                  !vehicleInfo && { opacity: 0.5 },
                ]}
                disabled={!vehicleInfo}
                onPress={registerVehicle}
              >
                <Text style={styles.saveVehicleButtonText}>Save Vehicle</Text>
              </Pressable>

            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  vehiclesPageContainer: {
    flex: 1,
    backgroundColor: "#f9fafb",
    paddingHorizontal: 16,
    paddingTop: 20,
  },

  vehiclesContainer: {
    marginBottom: 20,
    paddingBottom: 120,
  },

  vehicleCard: {
    backgroundColor: "#fff",
    marginVertical: 10,
    padding: 20,
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",

    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  addVehicleButton: {
    backgroundColor: "#111827",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 8,

    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 4,
    // marginBottom: 20,
    marginBottom: 55,
  },

  addVehicleButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },

  modalKeyboardWrapper: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },

  modalContent: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,

    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },

  vinLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    marginTop: 6,
    marginBottom: 6,
  },

  vinInput: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 12,
    backgroundColor: "#fff",
    fontSize: 15,
  },

  errorText: {
    color: "#ef4444",
    marginTop: 8,
    fontSize: 14,
    fontWeight: "500",
  },

  vehicleInfoPreview: {
    marginTop: 14,
    gap: 2,
  },

  saveVehicleButton: {
    backgroundColor: "#111827",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },

  saveVehicleButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
