class BLEManager {
    constructor() {
        this.device = null;
        this.server = null;
        this.relayChar = null; 
        this.currentChar = null;
        this.storageChar = null;
        this.currentSettings = null;
        this.isConnecting = false;

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
        // Wymuszamy formatowanie w polu input po korekcie
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

    async toggleConnection() {
        if (this.device && this.device.gatt.connected) {
            this.disconnect();
        } else {
            await this.connect();
        }
    }

    async connect() {
        if (this.isConnecting) return;
        this.isConnecting = true;
        
        try {
            this.device = await navigator.bluetooth.requestDevice({
                filters: [{ services: [this.UUIDS.CURRENT_SERVICE] }],
                optionalServices: [this.UUIDS.RELAY_SERVICE, this.UUIDS.STORAGE_SERVICE]
            });

            console.log("Łączenie z serwerem GATT...");
            this.server = await this.device.gatt.connect();
            
            // Krótka pauza na stabilizację połączenia
            await new Promise(resolve => setTimeout(resolve, 200));

            if (!this.server || !this.server.connected) throw new Error("GATT Server not connected");

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

            // 3. Serwis Ustawień (Storage)
            const storageService = await this.server.getPrimaryService(this.UUIDS.STORAGE_SERVICE);
            this.storageChar = await storageService.getCharacteristic(this.UUIDS.STORAGE_CHR);
            
            // Subskrypcja zmian ustawień (dla wielu klientów)
            await this.storageChar.startNotifications();
            this.storageChar.addEventListener('characteristicvaluechanged', (e) => this.handleSettingsUpdate(e));

            // Pobranie stanu początkowego przekaźnika
            if (this.relayChar) {
                const initialRelayVal = await this.relayChar.readValue();
                this.handleRelayUpdate({ target: { value: initialRelayVal } });
            }

            console.log("Połączono pomyślnie.");
            
            // Rejestrujemy rozłączenie dopiero po sukcesie
            this.device.addEventListener('gattserverdisconnected', () => this.onDisconnected());
            
            this.onConnected();

            // Pobranie ustawień z NVS zaraz po połączeniu
            await this.fetchStorageSettings();

        } catch (error) {
            console.error("Błąd połączenia:", error);
            this.onDisconnected();
        } finally {
            this.isConnecting = false;
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
        this.setControlsDisabled(false);
    }

    onDisconnected() {
        if (this.btn) {
            this.btn.innerText = "POŁĄCZ Z URZĄDZENIEM";
            this.btn.classList.replace('btn-danger', 'btn-primary');
        }
        if (this.statusDot) this.statusDot.classList.replace('text-success', 'text-muted');
        if (this.valueDisplay) this.valueDisplay.innerText = "0.00";
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