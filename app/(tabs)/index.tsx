// app/index.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

const USERS_KEY = "@CarbonIQ_Users"; // list of all users
const STORAGE_KEY = "@CarbonIQ_CurrentUser"; // currently logged in user

export default function AuthScreen() {
  const router = useRouter();

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if already logged in
  useEffect(() => {
    (async () => {
      try {
        const current = await AsyncStorage.getItem(STORAGE_KEY);
        if (current) {
          router.replace("/(tabs)");
        }
      } catch (e) {
        console.warn("Auto-login check failed", e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handleAuth = async () => {
    setError(null);
    if (!email || !password) return setError("Please enter both email and password.");

    try {
      const raw = await AsyncStorage.getItem(USERS_KEY);
      const users = raw ? JSON.parse(raw) : [];

      if (isRegister) {
        // prevent duplicate registration
        if (users.find((u: any) => u.email.toLowerCase() === email.toLowerCase())) {
          return setError("An account with this email already exists.");
        }

        if (!username.trim()) return setError("Please enter a username.");

        const newUser = {
          id: Date.now().toString(),
          username: username.trim(),
          email: email.trim().toLowerCase(),
          password,
          vehicles: [],
        };

        await AsyncStorage.setItem(USERS_KEY, JSON.stringify([...users, newUser]));
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
        Alert.alert("Success", "Account created successfully!");
        router.replace("/(tabs)");
      } else {
        // LOGIN
        const found = users.find((u: any) => u.email.toLowerCase() === email.toLowerCase());
        if (!found) return setError("No account found. Please sign up first.");
        if (found.password !== password) return setError("Incorrect password.");

        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(found));
        router.replace("/(tabs)");
      }
    } catch (e) {
      console.error("Auth error", e);
      setError("Sign-in failed. Please try again.");
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#111827" />
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.authContainer}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  authContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    padding: 20,
  },
  authCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  appTitle: { fontSize: 28, fontWeight: "800", color: "#111827", textAlign: "center", marginBottom: 16 },
  authTitle: { fontSize: 22, fontWeight: "700", textAlign: "center", marginBottom: 6 },
  authSub: { fontSize: 14, color: "#6b7280", textAlign: "center", marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    width: "100%",
    padding: 12,
    marginVertical: 8,
    backgroundColor: "#fff",
  },
  button: {
    backgroundColor: "#111827",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginVertical: 8,
  },
  buttonText: { color: "#fff", fontWeight: "700" },
  authToggle: { color: "#3b82f6", marginTop: 12, textAlign: "center", fontWeight: "500" },
  error: { color: "#ef4444", textAlign: "center", marginBottom: 6 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { color: "#6b7280", marginTop: 8 },
});
