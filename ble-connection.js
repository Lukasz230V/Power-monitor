function setControlsDisabled(disabled) {
    const connectButton = document.getElementById('connect-button');
    connectButton.disabled = false; // Keep the connect button always active
    
    // Add spinner feedback during connection
    const spinner = document.getElementById('spinner');
    if (disabled) {
        spinner.style.display = 'block'; // Show spinner when connecting
    } else {
        spinner.style.display = 'none'; // Hide spinner when not connecting
    }
}