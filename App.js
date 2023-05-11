

import React, { useState, useEffect } from 'react';
import { View, Text, AsyncStorage, StyleSheet, Button, TextInput } from 'react-native';
import QRCodeScanner from 'react-native-qrcode-scanner';
import { RNCamera } from 'react-native-camera';
import SMS from 'react-native-sms';
import axios from 'axios';
import BackgroundTask from 'react-native-background-task';

BackgroundTask.define(async () => {
  const result = await AsyncStorage.getItem('@MyApp:qrcode')
  if (result) {
    axios.get(result).then(async (message) => {
      const { phone_number, message } = message;
      const result = await SMS.sendSMSAsync([phone_number], smsMessage, {
        android: {
          intent: `sms://${phone_number}`,
          subId: selectedSim, // only for Android
        },
      });
      const status = result.success ? 'SUCCESS' : 'FAILED';
      axios.post(`${qrCode}?uuid=${message.uuid}&status=${status}`);
      AsyncStorage.setItem('@MyApp:last_message', { message: message, status: status })
    });
  }
});

AppRegistry.registerComponent('MyApp', () => App);

BackgroundTask.schedule({
  period: 300
});

export default function App() {
  const [cameraPermission, setCameraPermission] = useState(false);
  const [backgroundServicePermission, setBackgroundServicePermission] = useState(false);
  const [smsPermission, setSmsPermission] = useState(false);
  const [qrCode, setQrCode] = useState(null);
  const [message, setMessage] = useState(null);
  const [selectedSim, setSelectedSim] = useState(null);


  const checkMessages = async () => {
    const result = await AsyncStorage.getItem('@MyApp:last_message')
    if (result) {
      setMessage(result)
    }
  };

  useEffect(async () => {
    // Check permissions on app startup
    checkPermissions();
    const result = await AsyncStorage.getItem('@MyApp:qrcode')
    if (result) {
      setQrCode(result)
    }
    checkMessages();
  }, []);
  setInterval(checkMessages, 15000);

  const checkPermissions = async () => {
    // Check camera permission
    const cameraStatus = await RNCamera.checkRecordAudioPermission();
    setCameraPermission(cameraStatus === 'authorized');

    
    const status = await BackgroundTask.statusAsync()
    if (status.available) {
      setBackgroundServicePermission(true);
    } else {
      setBackgroundServicePermission(false);
      const reason = status.unavailableReason
      if (reason === BackgroundTask.UNAVAILABLE_DENIED) {
        Alert.alert('Denied', 'Please enable background permissions for this app')
      } else if (reason === BackgroundTask.UNAVAILABLE_RESTRICTED) {
        Alert.alert('Restricted', 'Background tasks are restricted on your device')
      }
    }
    
    // Check background service permission
    const backgroundStatus = await BackgroundFetch.checkStatus();
    setBackgroundServicePermission(backgroundStatus !== BackgroundFetch.STATUS_RESTRICTED);

    // Check SMS permission
    const smsStatus = await SMS.requestSendSMSPermission();
    setSmsPermission(smsStatus === 'granted');
  };

  const handleQrCodeScan = async (event) => {
    setQrCode(event.data);
    await AsyncStorage.setItem('@MyApp:qrcode', event.data)
    // Check if QR code URL is already stored
    // If not, store it in the device's memory
  };

  return (
    <View>
      {!cameraPermission || !backgroundServicePermission || !smsPermission ? (
        // Permission request screen
        <View>
          {!cameraPermission && <Text>Camera permission not granted</Text>}
          {!backgroundServicePermission && <Text>Background service permission not granted</Text>}
          {!smsPermission && <Text>SMS permission not granted</Text>}
          <Button title="Grant permissions" onPress={checkPermissions} />
        </View>
      ) : qrCode ? (
        // Send messages screen
        <View>
          <Text>Select SIM card:</Text>
          <TextInput value={selectedSim} onChangeText={async (simcard) => {
            setSelectedSim(simcard);
            await AsyncStorage.setItem('@MyApp:simcard', simcard)
          }} />
          <Text> ----- </Text>
            {message && (
              <View>
                <Text>Last Message:</Text>
                <Text>{message.message.phone_number}</Text>
                <Text>{message.message.message}</Text>
                <Text>{message.status}</Text>
              </View>
            )}
        </View>
      ) : (
        // QR code scan screen
        <QRCodeScanner onRead={handleQrCodeScan} />
      )}
    </View>
  );
};
