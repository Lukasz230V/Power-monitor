class BLEManager {
    constructor() {
        this.device = null;
        this.server = null;
        this.relayChar = null; 
        this.currentChar = null;
        this.storageChar = null;
        this.currentSettings = null;
        this.isConnecting = false;

        // Storage dla zapamiętanego urządzenia
        this.STORAGE_KEY = 'power-monitor-device-id';
        this.lastDeviceId = this.loadDeviceId();

        this.UUIDS = {
            STORAGE_SERVICE: 'cd9c5081-afd3-4cd5-89f0-e87b649bafe2',
            STORAGE_CHR:     '4e2cb81c-48e6-4ae3-9ecf-f6ab7f651883',
            CURRENT_SERVICE: 'dd630001-58fb-4b83-a7fc-21e10256eec7',
            CURRENT_CHAR:    'dd630011-58fb-4b83-a7fc-21e10256eec7',
            RELAY_SERVICE:   'dd630002-58fb-4b83-a7fc-21e10256eec7',
            RELAY_CHAR:      'dd630012-58fb-4b83-a7fc-21e10256eec7'
        };

        // Elementy UI
        this.btn = document.getElementById('connect-ble');
        this.statusDot = document.getElementById('ble-status-dot');
        this.valueDisplay = document.getElementById('adc-value');
        this.setCurrentInput = document.getElementById('set-current-input');
        this.setCurrentBtn = document.getElementById('set-current-btn');
        this.idleSlider = document.getElementById('idle-time-slider');
        this.idleDisplay = document.getElementById('idle-time-display');
        this.idleBtn = document.getElementById('set-idle-btn');
        this.idlePresets = document.querySelectorAll('.idle-preset');
        this.forgetBtn = document.getElementById('forget-device-btn');

        if (this.idleSlider) {
            this.idleSlider.addEventListener('input', (e) => {
                const val = e.target.value;
                if (this.idleDisplay) this.idleDisplay.innerText = val + "m";
                this.markChanged(this.idleBtn);
            });
        }

        this.idlePresets.forEach(btn => {
            btn.addEventListener('click', () => {
                const val = btn.dataset.value;
                if (this.idleSlider) this.idleSlider.value = val;
                if (this.idleDisplay) this.idleDisplay.innerText = val + "m";
                this.markChanged(this.idleBtn);
            });
        });

        if (this.setCurrentInput) {
            this.setCurrentInput.addEventListener('input', () => this.markChanged(this.setCurrentBtn));
        }

        if (this.setCurrentBtn) {
            this.setCurrentBtn.addEventListener('click', () => this.handleSaveAdc());
        }

        if (this.idleBtn) {
            this.idleBtn.addEventListener('click', () => this.handleSaveTimer());
        }

        if (this.forgetBtn) {
            this.forgetBtn.addEventListener('click', () => this.handleForgetDevice());
        }
    }

    // ====== ZAPAMIĘTYWANIE URZĄDZENIA ======
    saveDeviceId(deviceId) {
        try {
            localStorage.setItem(this.STORAGE_KEY, deviceId);
            console.log('✅ ID urządzenia zapisane:', deviceId);
        } catch (err) {
            console.error('Błąd zapisu ID:', err);
        }
    }

    loadDeviceId() {
        try {
            const id = localStorage.getItem(this.STORAGE_KEY);
            if (id) console.log('📦 Załadowane ID urządzenia:', id);
            return id;
        } catch (err) {
            console.error('Błąd odczytu ID:', err);
            return null;
        }
    }

    clearDeviceId() {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
            console.log('🗑️ ID urządzenia usunięte');
        } catch (err) {
            console.error('Błąd usuwania ID:', err);
        }
    }

    handleForgetDevice() {
        this.forgetDevice();
        if (this.forgetBtn) this.forgetBtn.style.display = 'none';
        if (this.btn) this.btn.innerText = 'POŁĄCZ Z URZĄDZENIEM';
    }

    forgetDevice() {
        this.clearDeviceId();
        this.lastDeviceId = null;
        if (this.device) {
            this.disconnect();
        }
        console.log('🗑️ Zapomniano urządzenie');
    }

    // Spróbuj połączyć się z zapamiętanym urządzeniem
    async connectToStoredDevice() {
        try {
            const devices = await navigator.bluetooth.getDevices();
            const storedDevice = devices.find(dev => dev.id === this.lastDeviceId);
            
            if (storedDevice) {
                console.log('🔗 Znaleziono zapamiętane urządzenie:', storedDevice.name);
                return storedDevice;
            } else {
                throw new Error('Zapamiętane urządzenie niedostępne');
            }
        } catch (err) {
            console.error('Błąd getDevices:', err);
            throw err;
        }
    }

    // Poproś użytkownika o wybór nowego urządzenia
    async requestNewDevice() {
        return await navigator.bluetooth.requestDevice({
            filters: [{ services: [this.UUIDS.CURRENT_SERVICE] }],
            optionalServices: [this.UUIDS.RELAY_SERVICE, this.UUIDS.STORAGE_SERVICE]
        });
    }

    markChanged(btn) {
        if (btn) {
            btn.classList.replace('btn-outline-primary', 'btn-primary');
            btn.classList.remove('disabled');
        }
    }

    resetBtnState(btn) {
        if (btn) {
            btn.classList.replace('btn-primary', 'btn-outline-primary');
        }
    }

    async handleSaveAdc() {
        if (!this.currentSettings) return;
        let val = parseFloat(this.setCurrentInput.value);
        if (isNaN(val) || val < 0.10) {
            val = 0.10;
        }
        this.setCurrentInput.value = val.toFixed(2);
        
        this.currentSettings.adcThreshold = val;
        await this.saveStorageSettings(this.currentSettings);
        this.resetBtnState(this.setCurrentBtn);
    }

    async handleSaveTimer() {
        if (!this.currentSettings) return;
        this.currentSettings.timer = parseInt(this.idleSlider.value) * 60;
        await this.saveStorageSettings(this.currentSettings);
        this.resetBtnState(this.idleBtn);
    }

    // async toggleConnection() {
    //     if (this.device && this.device.gatt.connected) {
    //         this.disconnect();
    //     } else {
    //         await this.connect();
    //     }
    // }

    async toggleConnection() {
    if (this.isConnecting) {
        // Jeśli użytkownik kliknie drugi raz podczas łączenia, 
        // możemy zresetować stan, by pozwolić na nową próbę
        this.isConnecting = false;
        this.connect(); 
        return;
    }
    
    if (this.device && this.device.gatt.connected) {
        this.disconnect();
    } else {
        await this.connect();
    }
}

    /*

async connect() {
        if (this.isConnecting) return;
        this.isConnecting = true;
        
        try {
            if (this.btn) {
                this.btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>ŁĄCZENIE...';
                this.btn.disabled = true; // Blokujemy, żeby uniknąć podwójnych kliknięć
            }

            // 1. Próba szybkiego odzyskania zapamiętanego urządzenia
            let deviceToConnect = null;
            if (this.lastDeviceId) {
                try {
                    // getDevices() na Androidzie bywa kapryśne, dajemy mu bardzo mało czasu
                    const devices = await navigator.bluetooth.getDevices();
                    deviceToConnect = devices.find(dev => dev.id === this.lastDeviceId);
                } catch (err) {
                    console.log('Błąd getDevices, przechodzę do requestDevice');
                }
            }

            // 2. KLUCZOWE DLA ANDROIDA: Jeśli nie mamy urządzenia, wywołujemy requestDevice 
            // jak najszybciej po kliknięciu, żeby nie stracić "User Gesture"
            if (!deviceToConnect) {
                console.log('🔍 Szukam nowego urządzenia...');
                deviceToConnect = await navigator.bluetooth.requestDevice({
                    filters: [{ services: [this.UUIDS.CURRENT_SERVICE] }],
                    optionalServices: [this.UUIDS.RELAY_SERVICE, this.UUIDS.STORAGE_SERVICE]
                });
            }

            this.device = deviceToConnect;

            if (!this.device) {
                throw new Error('Nie wybrano urządzenia');
            }

            // 3. Konfiguracja rozłączenia (usuwamy stary listener jeśli był)
            this.device.removeEventListener('gattserverdisconnected', () => this.onDisconnected());
            this.device.addEventListener('gattserverdisconnected', () => this.onDisconnected());

            // 4. Łączenie z GATT
            if (this.btn) this.btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>ŁĄCZĘ Z SERWEREM...';
            
            // Android naprawa: jeśli już połączony, rozłącz go przed nową próbą
            if (this.device.gatt.connected) {
                await this.device.gatt.disconnect();
            }

            this.server = await this.device.gatt.connect();
            
            await new Promise(resolve => setTimeout(resolve, 300)); // Stabilizacja

            if (this.btn) this.btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>POBIERANIE DANYCH...';

            // --- TWOJA LOGIKA SERWISÓW (BEZ ZMIAN) ---
            
            // 1. Serwis Prądu
            const currentService = await this.server.getPrimaryService(this.UUIDS.CURRENT_SERVICE);
            this.currentChar = await currentService.getCharacteristic(this.UUIDS.CURRENT_CHAR);
            await this.currentChar.startNotifications();
            this.currentChar.addEventListener('characteristicvaluechanged', (e) => this.handleData(e));
            
            // 2. Serwis Przekaźnika
            const relayService = await this.server.getPrimaryService(this.UUIDS.RELAY_SERVICE);
            this.relayChar = await relayService.getCharacteristic(this.UUIDS.RELAY_CHAR);
            await this.relayChar.startNotifications();
            this.relayChar.addEventListener('characteristicvaluechanged', (e) => this.handleRelayUpdate(e));

            // 3. Serwis Ustawień
            const storageService = await this.server.getPrimaryService(this.UUIDS.STORAGE_SERVICE);
            this.storageChar = await storageService.getCharacteristic(this.UUIDS.STORAGE_CHR);
            await this.storageChar.startNotifications();
            this.storageChar.addEventListener('characteristicvaluechanged', (e) => this.handleSettingsUpdate(e));

            if (this.relayChar) {
                const initialRelayVal = await this.relayChar.readValue();
                this.handleRelayUpdate({ target: { value: initialRelayVal } });
            }

            this.lastDeviceId = this.device.id;
            this.saveDeviceId(this.lastDeviceId);
            
            this.onConnected();
            await this.fetchStorageSettings();

        } catch (error) {
            console.error("❌ Błąd połączenia:", error);
            
            if (this.btn) {
                this.btn.disabled = false;
                this.btn.innerHTML = '❌ BŁĄD - SPRÓBUJ PONOWNIE';
                this.btn.classList.replace('btn-primary', 'btn-danger');
                
                // Przywróć stan przycisku po 3 sekundach
                setTimeout(() => {
                    if (!this.device || !this.device.gatt.connected) {
                        this.btn.innerHTML = 'POŁĄCZ Z URZĄDZENIEM';
                        this.btn.classList.replace('btn-danger', 'btn-primary');
                    }
                }, 3000);
            }
            this.onDisconnected();
        } finally {
            this.isConnecting = false;
            if (this.btn) this.btn.disabled = false;
        }
    }
*/


async connect() {
        if (this.isConnecting) return;
        this.isConnecting = true;
        
        try {
            // RESET STANU - najważniejsze dla Androida
            if (this.device && this.device.gatt.connected) {
                await this.device.gatt.disconnect();
            }
            this.server = null;
            this.device = null;

            if (this.btn) {
                this.btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>INICJACJA...';
                this.btn.disabled = true;
            }

            let deviceToConnect = null;

            // 1. Próba użycia zapamiętanego urządzenia (tylko jeśli API jest dostępne)
            if (this.lastDeviceId && navigator.bluetooth.getDevices) {
                try {
                    const devices = await navigator.bluetooth.getDevices();
                    deviceToConnect = devices.find(d => d.id === this.lastDeviceId);
                    console.log(deviceToConnect ? "Znaleziono w pamięci" : "Nie ma w pamięci");
                } catch (e) {
                    console.warn("Błąd getDevices", e);
                }
            }

            // 2. Jeśli nie ma urządzenia lub próba połączenia z zapamiętanym może potrwać za długo,
            // Android zablokuje okno wyboru. Dlatego jeśli nie mamy pewności, lepiej wywołać requestDevice.
            if (!deviceToConnect) {
                this.btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>WYBIERZ URZĄDZENIE...';
                deviceToConnect = await navigator.bluetooth.requestDevice({
                    filters: [{ services: [this.UUIDS.CURRENT_SERVICE] }],
                    optionalServices: [this.UUIDS.RELAY_SERVICE, this.UUIDS.STORAGE_SERVICE]
                });
            }

            this.device = deviceToConnect;

            // Dodajemy listener rozłączenia od razu
            this.device.addEventListener('gattserverdisconnected', () => this.onDisconnected());

            if (this.btn) this.btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>ŁĄCZENIE GATT...';

            // 3. Połączenie z serwerem
            this.server = await this.device.gatt.connect();
            
            // Mała pauza - Android jej potrzebuje na odświeżenie bazy usług
            await new Promise(r => setTimeout(r, 600));

            if (this.btn) this.btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>KONFIGURACJA...';

            // 4. Pobieranie serwisów - bezpośrednio (Twoja struktura)
            const currentService = await this.server.getPrimaryService(this.UUIDS.CURRENT_SERVICE);
            this.currentChar = await currentService.getCharacteristic(this.UUIDS.CURRENT_CHAR);
            await this.currentChar.startNotifications();
            this.currentChar.addEventListener('characteristicvaluechanged', (e) => this.handleData(e));
            
            const relayService = await this.server.getPrimaryService(this.UUIDS.RELAY_SERVICE);
            this.relayChar = await relayService.getCharacteristic(this.UUIDS.RELAY_CHAR);
            await this.relayChar.startNotifications();
            this.relayChar.addEventListener('characteristicvaluechanged', (e) => this.handleRelayUpdate(e));

            const storageService = await this.server.getPrimaryService(this.UUIDS.STORAGE_SERVICE);
            this.storageChar = await storageService.getCharacteristic(this.UUIDS.STORAGE_CHR);
            await this.storageChar.startNotifications();
            this.storageChar.addEventListener('characteristicvaluechanged', (e) => this.handleSettingsUpdate(e));

            // Pobranie danych startowych
            if (this.relayChar) {
                const val = await this.relayChar.readValue();
                this.handleRelayUpdate({ target: { value: val } });
            }

            this.lastDeviceId = this.device.id;
            this.saveDeviceId(this.lastDeviceId);
            this.onConnected();
            await this.fetchStorageSettings();

        } catch (error) {
            console.error("❌ Błąd połączenia:", error);
            // Jeśli błąd dotyczy zapamiętanego urządzenia, usuń je z pamięci, by przy następnym kliknięciu wymusić skanowanie
            if (this.lastDeviceId) {
                this.clearDeviceId();
                this.lastDeviceId = null;
            }
            this.handleConnectError(error);
        } finally {
            this.isConnecting = false;
            if (this.btn) this.btn.disabled = false;
        }
    }

    onDisconnected() {
        console.log("Urządzenie rozłączone - czyszczenie referencji");
        
        // Czyścimy flagi i referencje
        this.server = null;
        this.device = null;
        this.relayChar = null;
        this.currentChar = null;
        this.storageChar = null;

        if (this.btn) {
            this.btn.innerText = "POŁĄCZ Z URZĄDZENIEM";
            this.btn.classList.replace('btn-danger', 'btn-primary');
            this.btn.classList.replace('btn-success', 'btn-primary');
        }
        if (this.statusDot) {
            this.statusDot.classList.remove('text-success');
            this.statusDot.classList.add('text-muted');
        }
        this.setControlsDisabled(true);
    }

    handleConnectError(error) {
        if (this.btn) {
            this.btn.innerHTML = '❌ BŁĄD POŁĄCZENIA';
            this.btn.classList.replace('btn-primary', 'btn-danger');
            setTimeout(() => {
                this.btn.innerText = "POŁĄCZ Z URZĄDZENIEM";
                this.btn.classList.replace('btn-danger', 'btn-primary');
            }, 2000);
        }
    }
















    
    handleRelayUpdate(event) {
        const decoder = new TextDecoder();
        const value = decoder.decode(event.target.value).trim();
        const btn = document.getElementById("output-control");

        if (!btn) return;

        const isOn = (value === "ON");
        btn.dataset.state = value; 

        if (isOn) {
            btn.innerText = "ZAŁĄCZONE";
            btn.className = "btn btn-success flex-grow-1 w-100 py-4 h-100";
        } else {
            btn.innerText = "WYŁĄCZONE";
            btn.className = "btn btn-danger flex-grow-1 w-100 py-4 h-100";
        }
    }

    handleData(event) {
        const buffer = event.target.value;
        const floatVal = buffer.getFloat32(0, true);
        if (this.valueDisplay) {
            this.valueDisplay.innerText = floatVal.toFixed(2) + "A";
        }
    }

    handleSettingsUpdate(event) {
        const value = event.target.value;
        this.parseAndApplySettings(value);
    }

    parseAndApplySettings(value) {
        this.currentSettings = {
            fw:           value.getUint16(0, true),
            adcThreshold: value.getFloat32(2, true),
            mode:         value.getUint8(6),
            numCycles:    value.getUint8(7),
            timer:        value.getUint16(8, true)
        };

        console.log("Odebrano nastawy:", this.currentSettings);
        
        // Aktualizacja UI
        if (this.setCurrentInput) {
            this.setCurrentInput.value = parseFloat(this.currentSettings.adcThreshold).toFixed(2);
        }
        
        if (this.currentSettings.timer !== undefined) {
            const minutes = Math.floor(this.currentSettings.timer / 60);
            if (this.idleSlider) this.idleSlider.value = minutes;
            if (this.idleDisplay) this.idleDisplay.innerText = minutes + "m";
        }
        
        // Jeśli aktualizacja przyszła z zewnątrz, resetujemy stan przycisków "USTAW"
        this.resetBtnState(this.setCurrentBtn);
        this.resetBtnState(this.idleBtn);
    }

    async fetchStorageSettings() {
        try {
            if (!this.storageChar) return;
            const value = await this.storageChar.readValue();
            this.parseAndApplySettings(value);
            return this.currentSettings;
        } catch (error) {
            console.error("Błąd fetchStorageSettings:", error);
        }
    }

    async saveStorageSettings(s) {
        try {
            if (!this.storageChar || !this.device.gatt.connected) {
                console.error("Nie można zapisać: brak połączenia.");
                return;
            }
            const buffer = new ArrayBuffer(10);
            const view = new DataView(buffer);

            view.setUint16(0, s.fw, true);
            view.setFloat32(2, s.adcThreshold, true);
            view.setUint8(6, s.mode);
            view.setUint8(7, s.numCycles);
            view.setUint16(8, s.timer, true);

            await this.storageChar.writeValue(buffer);
            console.log("Zapisano ustawienia.");
        } catch (error) {
            console.error("Błąd zapisu ustawień:", error);
        }
    }

    disconnect() {
        if (!this.device) return;
        this.device.gatt.disconnect();
    }

    onConnected() {
        this.btn.innerText = "ROZŁĄCZ";
        this.btn.classList.replace('btn-primary', 'btn-danger');
        if (this.statusDot) this.statusDot.classList.replace('text-muted', 'text-success');
        if (this.forgetBtn) this.forgetBtn.style.display = 'inline-block';
        this.setControlsDisabled(false);
    }

    onDisconnected() {
        if (this.btn) {
            this.btn.innerText = "POŁĄCZ Z URZĄDZENIEM";
            this.btn.classList.replace('btn-danger', 'btn-primary');
        }
        if (this.statusDot) this.statusDot.classList.replace('text-success', 'text-muted');
        if (this.valueDisplay) this.valueDisplay.innerText = "0.00";
        if (this.forgetBtn) this.forgetBtn.style.display = 'none';
        this.setControlsDisabled(true);
        
        // Czyszczenie referencji (tylko jeśli nie jesteśmy w trakcie łączenia)
        this.relayChar = null;
        this.currentChar = null;
        this.storageChar = null;
        this.currentSettings = null;
        this.server = null;
        this.device = null;
        
        console.log("Urządzenie rozłączone.");
    }

    setControlsDisabled(disabled) {
        if (this.setCurrentInput) this.setCurrentInput.disabled = disabled;
        
        const updateBtn = (btn, dis) => {
            if (!btn) return;
            btn.disabled = dis;
            if (dis) btn.classList.add('disabled');
            else btn.classList.remove('disabled');
        };

        updateBtn(this.setCurrentBtn, disabled);
        updateBtn(this.idleBtn, disabled);
        
        if (this.idleSlider) this.idleSlider.disabled = disabled;
        
        this.idlePresets.forEach(btn => updateBtn(btn, disabled));
        
        // ⚠️ WAŻNE: Przycisk połączenia ZAWSZE powinien być aktywny!
        if (this.btn) this.btn.disabled = false;
    }

    // ====== ODŚWIEŻANIE DANYCH PRZY POWROCIE Z TŁA ======
    async refreshDataFromDevice() {
        try {
            if (!this.device?.gatt?.connected) {
                console.log('❌ Brak połączenia BLE - nie można odświeżyć');
                return;
            }

            console.log('🔄 Odświeżam dane z urządzenia...');

            // Odczytaj aktualny prąd
            if (this.currentChar) {
                try {
                    const currentValue = await this.currentChar.readValue();
                    this.handleData({ target: { value: currentValue } });
                    console.log('✅ Prąd zaktualizowany');
                } catch (err) {
                    console.error('Błąd odczytu prądu:', err);
                }
            }

            // Odczytaj stan przekaźnika
            if (this.relayChar) {
                try {
                    const relayValue = await this.relayChar.readValue();
                    this.handleRelayUpdate({ target: { value: relayValue } });
                    console.log('✅ Stan przekaźnika zaktualizowany');
                } catch (err) {
                    console.error('Błąd odczytu stanu:', err);
                }
            }

            // Odczytaj ustawienia
            if (this.storageChar) {
                try {
                    const settingsValue = await this.storageChar.readValue();
                    this.handleSettingsUpdate({ target: { value: settingsValue } });
                    console.log('✅ Ustawienia zaktualizowane');
                } catch (err) {
                    console.error('Błąd odczytu ustawień:', err);
                }
            }

        } catch (error) {
            console.error('❌ Błąd odświeżenia danych:', error);
        }
    }
}

// Obsługa przycisku wyjściowego (Output Control)
let holdTimer = null;

function sendCommand(value) {
    const ble = window.myBleDevice;
    if (ble && ble.device && ble.device.gatt.connected && ble.relayChar) {
        const encoder = new TextEncoder();
        const data = encoder.encode(value);
        ble.relayChar.writeValue(data)
            .catch(error => console.error("Błąd sterowania:", error));
    } else {
        console.warn("Brak połączenia - nie można wysłać komendy:", value);
    }
}

function handleOutputPress() {
    const btn = document.getElementById('output-control');
    if (!btn) return;
    const isCurrentlyOn = btn.dataset.state === "ON";

    if (!isCurrentlyOn) {
        sendCommand('ON');
    } else {
        btn.innerText = "PRZYTRZYMAJ 2s...";
        btn.classList.replace('btn-success', 'btn-warning');
        holdTimer = setTimeout(() => {
            sendCommand('OFF');
            btn.innerText = "WYŁĄCZANIE...";
            holdTimer = null;
        }, 2000);
    }
}

function handleOutputRelease() {
    if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
        const btn = document.getElementById('output-control');
        if (btn && btn.dataset.state === "ON") {
            btn.innerText = "ZAŁĄCZONE";
            btn.classList.replace('btn-warning', 'btn-success');
        }
    }
}

// Inicjalizacja aplikacji
const ble = new BLEManager(); 
window.myBleDevice = ble; 
document.getElementById('connect-ble').addEventListener('click', () => ble.toggleConnection());

const outputBtn = document.getElementById('output-control');
if (outputBtn) {
    outputBtn.addEventListener('mousedown', handleOutputPress);
    outputBtn.addEventListener('mouseup', handleOutputRelease);
    outputBtn.addEventListener('mouseleave', handleOutputRelease);
    outputBtn.addEventListener('touchstart', (e) => { e.preventDefault(); handleOutputPress(); });
    outputBtn.addEventListener('touchend', handleOutputRelease);
}

// ====== OBSŁUGA POWROTU Z TŁA ======
document.addEventListener('visibilitychange', async () => {
    if (document.hidden) {
        console.log('📱 Aplikacja przeszła do tła');
    } else {
        console.log('📱 Aplikacja powróciła z tła - odświeżam dane');
        
        // Odśwież dane z BLE urządzenia
        if (window.myBleDevice) {
            await window.myBleDevice.refreshDataFromDevice();
        }
    }
});

// Alternatywnie: obsługa focus window (dla PC)
window.addEventListener('focus', async () => {
    console.log('🖥️ Okno powróciło do fokusa - odświeżam dane');
    if (window.myBleDevice) {
        await window.myBleDevice.refreshDataFromDevice();
    }
});
