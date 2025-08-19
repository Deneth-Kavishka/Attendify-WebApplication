# Smart Attendance Hardware Setup Guide

## Required Components

### ESP32-CAM Setup
**Components:**
- ESP32-CAM module (AI-Thinker)
- FTDI programmer or USB-to-Serial adapter
- Breadboard and jumper wires
- External 5V power supply (recommended)
- Micro SD card (optional for backup)
- Status LEDs (2x)
- Push button
- Resistors (220Ω for LEDs, 10kΩ for button)

**Required Libraries:**
```cpp
// Install via Arduino IDE Library Manager
#include "esp_camera.h"        // ESP32 Camera Library
#include <WiFi.h>              // Built-in WiFi library
#include <HTTPClient.h>        // Built-in HTTP client
#include <ArduinoJson.h>       // ArduinoJson by Benoit Blanchon
#include <base64.h>            // Base64 by Densaugeo
