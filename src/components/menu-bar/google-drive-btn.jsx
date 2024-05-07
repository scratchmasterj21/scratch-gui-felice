import React, { useState } from 'react';

const GoogleDrivePickerButton = ({ developerKey, onProjectLoadFromExternalSource }) => {
    const [accessToken, setAccessToken] = useState(localStorage.getItem('googleAccessToken'));

    const loadPickerApi = () => {
        window.gapi.load('picker', () => {
            console.log("Picker API loaded.");
            createPicker(accessToken);
        });
    };

    const authenticateAndLoadPicker = () => {
        window.google.accounts.oauth2.initTokenClient({
            client_id: '313123590702-3klcs6d9ao9t368n91uuvi5ct1g1igld.apps.googleusercontent.com',
            scope: 'https://www.googleapis.com/auth/drive',
            callback: (response) => {
                if (response.error) {
                    console.error('Error fetching access token:', response.error);
                    return;
                }
                if (response.access_token) {
                    setAccessToken(response.access_token);
                    localStorage.setItem('googleAccessToken', response.access_token);
                    loadPickerApi(); // Load Picker after authentication
                } else {
                    console.log("No access token obtained, forcing login prompt.");
                    requestUserLogin(); // Additional method to handle login
                }
            },
        }).requestAccessToken({ prompt: 'select_account' });
    };
    
    const requestUserLogin = () => {
        window.google.accounts.oauth2.initTokenClient({
            client_id: '313123590702-3klcs6d9ao9t368n91uuvi5ct1g1igld.apps.googleusercontent.com',
            scope: 'https://www.googleapis.com/auth/drive.file',
            callback: (response) => {
                if (response.access_token) {
                    setAccessToken(response.access_token);
                    localStorage.setItem('googleAccessToken', response.access_token);
                    loadPickerApi(); // Proceed after login
                } else {
                    console.error('Failed to authenticate user.');
                }
            }
        }).requestAccessToken({ prompt: 'consent' });
    };
    
    const handleOpenPicker = () => {
        if (accessToken) {
            if (!window.google || !window.google.picker) {
                loadPickerApi(); // Ensures API is loaded
            } else {
                createPicker(accessToken);
            }
        } else {
            if (!window.google.accounts) {
                const script = document.createElement('script');
                script.src = "https://apis.google.com/js/api.js";
                script.onload = () => {
                    console.log("Google API script loaded, initializing OAuth client.");
                    authenticateAndLoadPicker();
                };
                document.body.appendChild(script);
            } else {
                authenticateAndLoadPicker();
            }
        }
    };
    

    const createPicker = (token) => {
        if (!window.google || !window.google.picker) {
            console.error("Picker API is not fully loaded yet.");
            return;
        }
        const picker = new window.google.picker.PickerBuilder()
            .addView(window.google.picker.ViewId.DOCS)
            .setOAuthToken(token)
            .setDeveloperKey(developerKey)
            .setCallback(pickerCallback)
            .build();
        picker.setVisible(true);
    };

    const pickerCallback = (data) => {
        if (data[window.google.picker.Response.ACTION] === window.google.picker.Action.PICKED) {
            const fileId = data[window.google.picker.Response.DOCUMENTS][0].id;
            const fileName = data[window.google.picker.Response.DOCUMENTS][0].name;
            fetchFile(fileId, fileName);
        }
    };

    const fetchFile = async (fileId, fileName) => {
        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: new Headers({ 'Authorization': `Bearer ${accessToken}` })
        });
        const data = await response.arrayBuffer();
        onProjectLoadFromExternalSource(data, fileName);
    };

    return (
        <div onClick={handleOpenPicker}>Load from Google Drive</div>
    );
};

export default GoogleDrivePickerButton;
