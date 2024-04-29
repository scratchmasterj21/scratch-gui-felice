export const loadGoogleApis = (onGoogleApiLoaded) => {
    const gisScript = document.createElement('script');
    gisScript.src = "https://accounts.google.com/gsi/client";
    gisScript.onload = () => {
        console.log("Google Identity Services loaded.");
        window.google.accounts.oauth2.initTokenClient({
            client_id: '313123590702-3klcs6d9ao9t368n91uuvi5ct1g1igld.apps.googleusercontent.com',
            scope: 'https://www.googleapis.com/auth/drive.file',
            callback: (response) => {
                if (response.error) {
                    console.error('Error fetching access token:', response.error);
                    return;
                }
                const accessToken = response.access_token;
                onGoogleApiLoaded(accessToken);
            },
        }).requestAccessToken({prompt: 'consent'});
    };
    document.body.appendChild(gisScript);

    const apiScript = document.createElement('script');
    apiScript.src = "https://apis.google.com/js/api.js";
    apiScript.onload = () => {
        console.log("Google API loaded.");
        window.gapi.load('client:picker', initializePicker);
    };

    document.body.appendChild(apiScript);
};

    const initializePicker = async () => {
        try {
            await window.gapi.client.load('https://www.googleapis.com/discovery/v1/apis/drive/v3/rest');
            console.log("Drive API loaded and Picker initialized.");
        } catch (error) {
            console.error("Error loading the Google Drive API:", error);
        }
    };