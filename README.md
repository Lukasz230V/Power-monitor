# Power-Monitor

Nadzór podłączonego urządzenia, jeśli pobór prądu spadnie poniżej zadanej wartości odłącza całkowicie zasilanie, przydatne przy urządzeniach które nie wchodzą w standby lub mają zawyżony pobór mocy w tym trybie. Może pracować zarówno z prądami **AC** i **DC**.

## 🌐 Live Demo

**[→ Otwórz aplikację PWA](https://lukasz230v.github.io/Power-monitor/)**

## 📋 Opis projektu

**Power-Monitor** to system monitorowania poboru energii elektrycznej, składający się z:
- 🌐 **Interfejsu webowego** (JavaScript/HTML/CSS) - ta aplikacja
- ⚙️ **Firmware ESP32-S3** (ESP-IDF) - sterowanie urządzeniem wbudowanym

System automatycznie wyłącza zasilanie urządzenia po przekroczeniu ustawionego limitu poboru prądu, chroniąc przed przeciążeniem sieci.

## 🔌 Komponenty

### 1. Frontend (Power-monitor)
- **Aplikacja webowa** do zarządzania urządzeniem
- Monitorowanie poboru prądu w czasie rzeczywistym
- Ustawianie limitów poboru
- Interfejs BLE do komunikacji z ESP32-S3
- **Dostępna na:** https://lukasz230v.github.io/Power-monitor/

### 2. Firmware (p-monitor-fw)
- **ESP32-S3** firmware napisany w ESP-IDF
- Obsługa pomiaru prądu AC/DC
- Kontrola zasilania
- Komunikacja BLE z interfejsem webowym

**[→ Przejdź do repozytorium firmware](https://github.com/Lukasz230V/p-monitor-fw)**

## 🚀 Quick Start

### Interfejs webowy (PWA)

1. **Otwórz aplikację:** https://lukasz230v.github.io/Power-monitor/
2. Pozwól przeglądarce na dostęp do BLE
3. Połącz się z urządzeniem ESP32-S3
4. Zacznij monitorować pobór prądu

### Firmware ESP32-S3

Szczegółowe instrukcje znajdują się w [p-monitor-fw README](https://github.com/Lukasz230V/p-monitor-fw)

```bash
git clone https://github.com/Lukasz230V/p-monitor-fw.git
cd p-monitor-fw
idf.py menuconfig
idf.py build
idf.py -p /dev/ttyUSB0 flash monitor
```

## 📁 Struktura projektu

```
Power-monitor/
├── index.html              # Główna strona
├── ble-connection.js       # Obsługa BLE
├── service-worker.js       # Service Worker (PWA)
├── manifest.json           # Konfiguracja PWA
├── assets/                 # Zasoby aplikacji
└── README.md               # Ten plik
```

## 🔧 Technologia

| Komponent | Technologia |
|-----------|------------|
| Frontend  | JavaScript, HTML5, CSS3 |
| Backend   | ESP32-S3, ESP-IDF |
| Komunikacja | BLE (Bluetooth Low Energy) |
| Hosting | GitHub Pages |

## 📊 Statystyka projektu

- **Języki**: JavaScript (71.6%), HTML (26.6%), CSS (1.8%)
- **Licencja**: MIT

## 📚 Dokumentacja

- [ESP-IDF Documentation](https://docs.espressif.com/projects/esp-idf/)
- [Web Bluetooth API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API)
- [PWA Documentation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)

## 🐛 Troubleshooting

### Problem z połączeniem BLE

1. Upewnij się, że przeglądarka obsługuje Web Bluetooth API (Chrome, Edge, Brave)
2. Sprawdź czy ESP32-S3 jest włączony i transmituje BLE
3. Spróbuj w innej przeglądarce

### Problem z uplodem firmware

Patrz [p-monitor-fw Troubleshooting](https://github.com/Lukasz230V/p-monitor-fw#troubleshooting)

## 📝 Licencja

MIT

## 🤝 Wsparcie

Jeśli masz pytania lub problemy:
- Stwórz [Issue](https://github.com/Lukasz230V/Power-monitor/issues)
- Sprawdź [dokumentację firmware](https://github.com/Lukasz230V/p-monitor-fw)

---

**Powiązane projekty:**
- [p-monitor-fw](https://github.com/Lukasz230V/p-monitor-fw) - Firmware ESP32-S3
