import React, { useState, useEffect } from 'react';

const GoogleDrivePickerButton = ({ developerKey, onProjectLoadFromExternalSource }) => {
    const [accessToken, setAccessToken] = useState(null);

    useEffect(() => {
        if (accessToken) {
            createPicker(accessToken);
        }
    }, [accessToken]); // This will trigger when accessToken changes.

    const authenticateAndLoadPicker = () => {
        window.google.accounts.oauth2.initTokenClient({
            client_id: '313123590702-3klcs6d9ao9t368n91uuvi5ct1g1igld.apps.googleusercontent.com',
            scope: 'https://www.googleapis.com/auth/drive.file',
            callback: (response) => {
                if (response.error) {
                    console.error('Error fetching access token:', response.error);
                    return;
                }
                setAccessToken(response.access_token);
            },
        }).requestAccessToken({ prompt: 'consent' });
    };

    const loadPickerApi = () => {
        window.gapi.load('picker', () => {
            console.log("Picker API loaded.");
            // The picker API is ready now, authenticate the user
            authenticateAndLoadPicker();
        });
    };

    const handleOpenPicker = () => {
        if (accessToken) {
            // If already have an access token, create the picker right away
            createPicker(accessToken);
        } else {
            // Load the Picker API and authenticate the user
            if (!window.gapi) {
                const script = document.createElement('script');
                script.src = "https://apis.google.com/js/api.js";
                script.onload = loadPickerApi;
                document.body.appendChild(script);
            } else {
                loadPickerApi();
            }
        }
    };

    const createPicker = (token) => {
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
