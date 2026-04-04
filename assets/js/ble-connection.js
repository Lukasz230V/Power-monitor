    refreshDataFromDevice() {
        // Implement the logic to refresh data from the device
        console.log('Data refreshed from device');
    }

    // Existing code...

    // Event listeners
    outputButton.addEventListener('click', () => {
        this.outputData();
    });

    // Add visibility change and focus event listeners
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            this.refreshDataFromDevice();
        }
    });

    window.addEventListener('focus', () => {
        this.refreshDataFromDevice();
    });

}