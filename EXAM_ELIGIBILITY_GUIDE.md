# Exam Eligibility Management System - User Guide

## Overview

The Exam Eligibility Management System is a comprehensive feature that automatically tracks student attendance and determines exam eligibility based on the 75% attendance threshold requirement. This system integrates with hardware devices (ESP32-CAM and RFID readers) for real-time monitoring.

## Key Features

### 1. Real-Time Eligibility Tracking

- **Automatic Calculation**: System automatically calculates attendance percentage for each student
- **75% Threshold**: Students need ≥75% attendance to be eligible for examinations
- **Real-Time Updates**: Eligibility status updates every 30 seconds
- **Hardware Integration**: Works with ESP32-CAM face recognition and RFID card systems

### 2. Dashboard Statistics

The main dashboard displays:

- **Exam Eligible Students**: Count of students with ≥75% attendance
- **At Risk Students**: Count of students with <75% attendance
- **Average Attendance**: Overall attendance percentage across all students
- **Active Classes**: Number of classes being monitored

### 3. Class-Based Monitoring

- **Class Selection**: Filter eligibility by specific classes
- **Individual Student Details**: View comprehensive attendance records
- **Attendance Trends**: 8-week attendance trend visualization
- **Hardware Detection**: Shows which device (ESP32-CAM or RFID) last detected the student

### 4. Student Detail Analysis

For each student, the system provides:

- **Current Attendance Percentage**: Real-time calculation
- **Classes Attended vs Total**: Detailed breakdown
- **Eligibility Status**: Clear eligible/at-risk indication
- **Required Classes**: Number of additional classes needed to reach 75%
- **Recent Attendance History**: Last 10 attendance records with timestamps
- **Detection Method**: Whether detected by face recognition or RFID

### 5. Hardware Integration Features

- **ESP32-CAM Face Recognition**:
  - Real-time face detection and recognition
  - Confidence scoring for accuracy
  - Visual status indicators (scanning/ready)
- **RFID Card Reader**:
  - Instant card-based attendance marking
  - Student card validation
  - Range and frequency monitoring

### 6. Advanced Analytics

- **Weekly Trend Charts**: Visual representation of attendance patterns
- **Predictive Analysis**: Early warning for students at risk
- **Hardware Performance**: Device status and scan statistics
- **Real-Time Notifications**: Instant alerts for critical attendance issues

### 7. Bulk Operations

- **Bulk Eligibility Check**: Process entire classes at once
- **Mass Notifications**: Send eligibility alerts to multiple students
- **Report Generation**: Export comprehensive eligibility reports
- **Class-Wide Analysis**: Compare attendance across different classes

## Hardware Device Integration

### ESP32-CAM Face Recognition System

```
Device Type: ESP32-CAM with Face Recognition
Location: Main Entrance / Classroom Entry
Status: Online/Offline indicators
Features:
- Real-time face detection
- Student face recognition
- Confidence scoring (>85% threshold)
- Automatic attendance marking
- Live scanning indicators
```

### RFID Card Reader System

```
Device Type: RFID Reader (125kHz)
Location: Main Entrance / Classroom Entry
Status: Online/Offline indicators
Features:
- Instant card scanning
- Student ID validation
- Range monitoring (10cm range)
- Quick attendance marking
- Active scanning indicators
```

## User Workflow

### For Administrators:

1. **Access Exam Eligibility**:

   - Navigate to Admin Dashboard
   - Click "Exam Eligibility" in sidebar or quick actions
   - View real-time statistics dashboard

2. **Monitor Specific Class**:

   - Select class from dropdown filter
   - View filtered student eligibility list
   - Real-time hardware status monitoring

3. **Analyze Individual Students**:

   - Click "Details" for any student
   - Review comprehensive attendance analysis
   - View 8-week attendance trends
   - Check hardware detection history

4. **Bulk Operations**:

   - Select multiple students using checkboxes
   - Send eligibility notifications
   - Perform bulk eligibility checks
   - Export detailed reports

5. **Hardware Monitoring**:
   - Monitor ESP32-CAM scanning status
   - Check RFID reader activity
   - View device online/offline status
   - Real-time scan indicators

### For System Automation:

1. **Real-Time Processing**:

   - ESP32-CAM detects student faces
   - RFID readers scan student cards
   - Attendance automatically recorded
   - Eligibility status updated instantly

2. **Threshold Monitoring**:
   - System continuously calculates percentages
   - Automatic flagging of at-risk students
   - Real-time eligibility status updates
   - Hardware performance monitoring

## Technical Specifications

### Attendance Calculation

```javascript
Attendance Percentage = (Classes Attended / Total Classes) × 100
Eligible if: Attendance Percentage ≥ 75%
Required Classes = ceil((0.75 × Total Classes) - Classes Attended)
```

### Hardware Communication

- **ESP32-CAM**: Face recognition with confidence scoring
- **RFID Reader**: 125kHz frequency, 10cm range
- **Real-time Updates**: 2-second refresh intervals
- **WebSocket Integration**: Live device status monitoring

### Data Refresh Rates

- **Statistics Dashboard**: 30-second intervals
- **Student Lists**: 30-second intervals
- **Hardware Status**: 2-second intervals
- **Individual Details**: On-demand refresh

## Benefits

### For Educational Institutions:

- **Automated Compliance**: Ensures attendance requirement compliance
- **Early Warning System**: Identifies at-risk students early
- **Hardware Integration**: Seamless device connectivity
- **Real-Time Monitoring**: Live attendance tracking
- **Comprehensive Reporting**: Detailed eligibility documentation

### For Administrators:

- **Efficiency**: Automated eligibility calculation
- **Accuracy**: Hardware-verified attendance
- **Insights**: Trend analysis and predictions
- **Flexibility**: Class-based and bulk operations
- **Reliability**: Real-time hardware monitoring

### For Students:

- **Transparency**: Clear eligibility status
- **Accountability**: Real-time attendance tracking
- **Convenience**: Multiple detection methods (face + RFID)
- **Feedback**: Immediate attendance confirmation

## System Requirements

### Hardware Requirements:

- ESP32-CAM modules with face recognition capability
- RFID card readers (125kHz)
- Network connectivity for real-time updates
- Student RFID cards for backup identification

### Software Requirements:

- Modern web browser with JavaScript enabled
- Network connection for real-time features
- Admin-level access for full functionality

## Troubleshooting

### Common Issues:

1. **Hardware Offline**: Check device power and network connectivity
2. **Recognition Failures**: Ensure proper lighting for ESP32-CAM
3. **RFID Issues**: Verify card proximity and reader functionality
4. **Data Sync**: Refresh page or check network connection

### Support Features:

- Real-time device status monitoring
- Automatic error detection and reporting
- Hardware health indicators
- System performance metrics

This comprehensive Exam Eligibility Management System provides a complete solution for educational institutions to monitor attendance and ensure examination eligibility compliance through automated hardware integration and real-time analytics.
