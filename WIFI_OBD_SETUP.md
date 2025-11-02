# WiFi OBD-II Setup Guide

## 📡 Overview

This guide will help you connect your WiFi OBD-II adapter directly to the CarbonIQ app, just like your Python code connects to `/tmp/obdserial`.

## 🔌 What You Need

- **WiFi OBD-II Adapter** (creates its own WiFi network)
- **Vehicle** with OBD-II port (1996+)
- **CarbonIQ Mobile App**

## 🚗 Step-by-Step Setup

### 1. Connect OBD Adapter

1. **Plug your WiFi OBD adapter** into your vehicle's OBD port (usually under the dashboard)
2. **Turn on your vehicle** (OBD port is powered when engine is on)
3. **Wait for adapter to boot** (usually 10-30 seconds)

### 2. Connect Phone to OBD WiFi

1. **Open WiFi settings** on your phone
2. **Look for OBD adapter network** (usually named something like):
   - `OBDII-XXXX`
   - `WiFiOBD-XXXX`
   - `ELM327-XXXX`
   - `OBD-XXXX`
3. **Connect to the network** (usually no password required)
4. **Note the IP address** (usually `192.168.0.10` or similar)

### 3. Configure CarbonIQ App

1. **Open CarbonIQ app**
2. **Go to "Start" tab**
3. **Tap "WiFi OBD" toggle**
4. **Enter configuration**:
   - **Host**: `192.168.0.10` (or your adapter's IP)
   - **Port**: `35000` (or try `8080`, `23`)
5. **Tap "Save & Connect"**

### 4. Start Tracking

1. **Select your vehicle** from the car dropdown
2. **Ensure WiFi OBD shows "Connected"**
3. **Tap "Start Journey"**
4. **Real OBD data will appear** in the telemetry section

## 🔧 Common WiFi OBD Settings

### Default IP Addresses
- `192.168.0.10` (most common)
- `192.168.1.1`
- `192.168.4.1`
- `10.0.0.1`

### Common Ports
- `35000` (most common)
- `8080`
- `23`
- `80`

## 🔍 Finding Your Adapter's Settings

### Method 1: Check Adapter Label
Look for a sticker on your OBD adapter that shows:
- WiFi network name
- IP address
- Port number

### Method 2: Check Phone WiFi Settings
1. Connect to OBD WiFi network
2. Go to WiFi settings
3. Tap the connected network
4. Look for "Router" or "Gateway" IP address

### Method 3: Use Network Scanner App
Download a network scanner app to find devices on the OBD network.

## 🚨 Troubleshooting

### "Connection Failed"
- **Check WiFi connection**: Make sure you're connected to the OBD adapter's WiFi
- **Try different IP**: Common IPs are `192.168.0.10`, `192.168.1.1`
- **Try different port**: Common ports are `35000`, `8080`, `23`
- **Restart adapter**: Unplug and replug the OBD adapter

### "No Data Received"
- **Check vehicle compatibility**: Some older vehicles have limited OBD support
- **Verify adapter type**: Make sure it's ELM327 compatible
- **Check OBD port**: Ensure adapter is properly seated

### "WiFi Network Not Found"
- **Check adapter power**: OBD port should power the adapter when engine is on
- **Wait for boot**: Some adapters take 30+ seconds to create WiFi network
- **Check adapter LED**: Most adapters have status LEDs

## 📱 App Configuration Tips

### Save Multiple Configurations
The app saves your WiFi OBD settings, so you only need to configure once per adapter.

### Test Connection
- Use the "Common WiFi OBD" preset button for quick setup
- Try different ports if the default doesn't work
- Check the telemetry section to see if real data is coming through

### Connection Status
- **Off**: WiFi OBD not connected
- **Connecting...**: Attempting to connect
- **Connected**: Successfully connected to WiFi OBD adapter

## 🔄 How It Works

1. **OBD Adapter** creates WiFi network and acts as TCP server
2. **Your phone** connects to adapter's WiFi network
3. **CarbonIQ app** connects to adapter via TCP (like your Python code)
4. **Real-time data** flows from vehicle → adapter → phone → app

## 📊 Data You'll See

When connected to WiFi OBD, you'll get real data:
- **Speed**: Actual vehicle speed from speed sensor
- **RPM**: Real engine RPM from ECU
- **MAF**: Mass Air Flow from air intake sensor
- **Engine Load**: Calculated engine load percentage
- **Throttle**: Throttle position from pedal sensor

## 🎯 Pro Tips

### For Best Results
- **Keep phone charged**: WiFi connection uses more battery
- **Stay close to vehicle**: WiFi range is usually 10-30 meters
- **Use phone holder**: Keep phone accessible while driving
- **Test before trip**: Verify connection before starting journey

### Multiple Vehicles
- Each vehicle may need different settings
- Save configurations for different adapters
- Some adapters work better with certain vehicles

---

**🎉 That's it!** Your WiFi OBD adapter now works just like your Python script, providing real-time vehicle data directly to your CarbonIQ app.
