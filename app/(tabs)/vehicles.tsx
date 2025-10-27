import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Pressable, StyleSheet, ScrollView, Text, View } from 'react-native';
import { init, i , id} from '@instantdb/react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';

// ID for app: CarbonTracker
const APP_ID = 'd8681029-bc7b-4e69-886b-74815444c014';

// Optional: You can declare a schema!
const schema = i.schema({
  entities: {
    vehicles: i.entity({
      vehicleId: i.string(),
      name: i.string(),
      vin: i.string(),
      body: i.string(),
      fuel: i.string(),
      vehicleType: i.string(),
      year: i.number(),
      trend: i.number(),
      ownerId: i.string()
    }),
  },
});

interface vehicle {
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

const vehicle = {
  vehicleId: "VH12345",
  name: "Tesla Model 3",
  vin: "5YJ3E1EA7JF000123",
  body: "Sedan",
  fuel: "Electric",
  vehicleType: "Passenger",
  year: 2023,
  trend: 8,
  ownerId: "USR001"
};

const db = init({ appId: APP_ID, schema });

// const selectId = '4d39508b-9ee2-48a3-b70d-8192d9c5a059';

export default function VehiclesScreen() {
  const query = { vehicles: {} };
  const { data } = db.useQuery(query);
  console.log(data?.vehicles);

  const vehicles: vehicle[] | undefined = data?.vehicles;

  return (
    <View style={styles.vehiclesPageContainer}>
      <ThemedView style={styles.titleContainer}>
          <ThemedText type='title'>Vehicles</ThemedText>
      </ThemedView>
      <ScrollView style={styles.vehiclesContainer}>
        {vehicles?.map((v) => (
            <ThemedView style={styles.vehicleCard} key={v.id}>
              <ThemedText>{v.name}</ThemedText>
              <Pressable
                onPress={() => db.transact(db.tx.vehicles[v.id].delete())}
              >
                <IconSymbol size={28} name="trash" color='black' />
              </Pressable>
            </ThemedView>
        ))
        }
      </ScrollView>
      <Pressable 
        style={styles.addVehicleButton}
        onPress={() => db.transact(db.tx.vehicles[id()].create(vehicle))}
      >
        <IconSymbol size={28} name="plus" color='white' />
        <Text style={styles.addVehicleButtonText}>New Car</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  vehiclesPageContainer: {
  },
  headerImage: {
    color: '#808080',
    bottom: -90,
    left: -35,
    position: 'absolute',
  },
  titleContainer: {
    gap: 8,
    padding: 10
  },
  vehiclesContainer:{
    maxHeight: '80%'
  },
  vehicleCard: {
    margin: 15,
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  addVehicleButton: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'black',
    padding: 10,
    borderRadius: 10,
    top: 500,
    position: 'absolute'
  },
  addVehicleButtonText: {
    color: 'white'
  },
});

// const registerVehicle = async () => {
//   if (!vehicle || !userData) return;
//   const newVehicleId = Date.now().toString();
//   const newV: Vehicle = {
//     id: newVehicleId,
//     name: `${vehicle.make} ${vehicle.model}`,
//     vin,
//     body: vehicle.body,
//     fuel: vehicle.fuelTypePrimary,
//     vehicleType: vehicle.vehicleType,
//     year: vehicle.year,
//     trend: generateRandomTrend(),
//     ownerId: currentUserId,
//   };

//   const updatedUser = {
//     ...userData,
//     vehicles: [...userData.vehicles, newV],
//   };

//   setUserData(updatedUser);
//   await saveLocalData(updatedUser);
//   LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
//   setVin("");
//   setVehicle(null);
//   setVinModal(false);
// };

//   const decodeVin = async () => {
//   const v = vin.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
//   if (v.length < 11) return setError("VIN must be at least 11 characters.");
//   setError("");
//   setLoading(true);
//   try {
//     const res = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${v}?format=json`);
//     const data = await res.json();
//     const r = data?.Results?.[0] || {};
//     const info = {
//       make: r.Make || "Unknown",
//       model: r.Model || "Unknown",
//       year: r.ModelYear || 0,
//       body: r.BodyClass || "Unknown",
//       vehicleType: r.VehicleType || "Unknown",
//       fuelTypePrimary: r.FuelTypePrimary || "Unknown",
//     };
//     if (!info.make || info.make === "Unknown") {
//       setError("Could not decode VIN");
//       setVehicle(null);
//     } else {
//       setVehicle(info);
//     }
//   } catch {
//     setError("Network error. Please check your connection and try again.");
//     setVehicle(null);
//   } finally {
//     setLoading(false);
//   }
// };

// const generateRandomTrend = () => {
//   const base = 170;
//   return Array.from({ length: 5 }, (_, i) => base - Math.floor(Math.random() * 10) * (i + 1));
// };
