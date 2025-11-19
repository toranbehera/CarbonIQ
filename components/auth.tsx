import AsyncStorage from "@react-native-async-storage/async-storage";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useState } from "react";
import { View, TextInput, TouchableOpacity, Text, Platform, UIManager } from "react-native";
import { StyleSheet } from "react-native";

const VIN_MAX_LEN = 17;

const Tab = createBottomTabNavigator();

const STORAGE_KEY = "@CarbonIQ_LocalData";

interface Vehicle {
  id: string;
  name: string;
  vin: string;
  body: string;
  fuel: string;
  vehicleType: string;
  year: number;
  trend: number[];
  ownerId: string;
}

interface UserData {
  id: string;
  username: string;
  email: string;
  vehicles: Vehicle[];
}
interface StoredUser extends UserData {
  password: string;
}


export default function AuthScreen({ onLogin, setUserData, saveLocalData }: any) {
  const USERS_KEY = "@CarbonIQ_Users";
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async () => {
    if (!email || !password) return setError("Email and password are required.");
    setError(null);

    try {
      const json = await AsyncStorage.getItem(USERS_KEY);
      const allUsers: StoredUser[] = json ? JSON.parse(json) : [];

      if (isRegister) {
        if (!username) return setError("Username is required for registration.");
        const existingUser = allUsers.find((u) => u.email === email);
        if (existingUser) return setError("An account with this email already exists.");

        const userId = Date.now().toString();
        const newUser: UserData = {
          id: userId,
          username,
          email,
          vehicles: [],
        };

        const newStoredUser: StoredUser = { ...newUser, password };
        const updatedUsers: StoredUser[] = [...allUsers, newStoredUser];

        await AsyncStorage.setItem(USERS_KEY, JSON.stringify(updatedUsers));
        await saveLocalData(newUser);
        setUserData(newUser);
        onLogin(true);
      } else {
        const existingUser = allUsers.find((u) => u.email === email);
        if (!existingUser) return setError("Account not found. Please sign up first.");
        if (existingUser.password !== password) return setError("Incorrect password.");

        const currentUser: UserData = {
          id: existingUser.id,
          username: existingUser.username,
          email: existingUser.email,
          vehicles: existingUser.vehicles || [],
        };

        await saveLocalData(currentUser);
        setUserData(currentUser);
        onLogin(true);
      }
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
  };

  return (
    <View style={styles.authContainer}>
      <View style={styles.authCard}>
        <Text style={styles.appTitle}>CarbonIQ</Text>
        <Text style={styles.authTitle}>{isRegister ? "Create Account" : "Welcome Back"}</Text>
        <Text style={styles.authSub}>
          {isRegister ? "Sign up to track your emissions" : "Login to continue"}
        </Text>
        {error && <Text style={styles.error}>{error}</Text>}

        {isRegister && (
          <TextInput
            placeholder="Username"
            value={username}
            onChangeText={setUsername}
            style={styles.input}
            autoCapitalize="none"
          />
        )}
        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          style={styles.input}
          secureTextEntry
        />

        <TouchableOpacity style={styles.button} onPress={handleAuth}>
          <Text style={styles.buttonText}>{isRegister ? "Register" : "Login"}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setIsRegister(!isRegister)}>
          <Text style={styles.authToggle}>
            {isRegister ? "Already have an account? Login" : "New here? Create an account"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
    authContainer: { 
        flex: 1, 
        justifyContent: "center", 
        alignItems: "center", 
        padding: 24, 
        backgroundColor: "#f9fafb" 
    },
    authCard: { width: "100%", maxWidth: 400, backgroundColor: "#fff", borderRadius: 16, padding: 24, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 },
    input: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, width: "100%", padding: 12, marginVertical: 8, backgroundColor: "#fff" },
    button: { backgroundColor: "#111827", paddingVertical: 14, borderRadius: 10, width: "100%", alignItems: "center", marginVertical: 8 },
    buttonText: { color: "#fff", fontWeight: "700" },
    appTitle: { fontSize: 28, fontWeight: "800", color: "#111827", textAlign: "center", marginBottom: 16 },
    authTitle: { fontSize: 24, fontWeight: "700", textAlign: "center", marginBottom: 4 },
    authSub: { fontSize: 14, color: "#6b7280", textAlign: "center", marginBottom: 24 },
    authToggle: { color: "#3b82f6", marginTop: 16, textAlign: "center", fontWeight: "500" },
    error: { color: "#ef4444", textAlign: "center", marginTop: 6, marginBottom: 10 }
});
