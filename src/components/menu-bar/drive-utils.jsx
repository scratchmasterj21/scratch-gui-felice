// utilities/googleDriveUtils.js
export const loadGoogleApis = (onGoogleApiLoaded) => {
    const gisScript = document.createElement('script');
    gisScript.src = "https://accounts.google.com/gsi/client";
    gisScript.onload = () => {
        console.log("Google Identity Services loaded.");

        // Check if we already have an access token stored
        const storedAccessToken = localStorage.getItem('googleAccessToken');
        if (storedAccessToken) {
            console.log("Using stored access token.");
            onGoogleApiLoaded(storedAccessToken);
            return;
        }

        // Initialize token client only if we do not have a stored token
        window.google.accounts.oauth2.initTokenClient({
            client_id: '313123590702-3klcs6d9ao9t368n91uuvi5ct1g1igld.apps.googleusercontent.com',
            scope: 'https://www.googleapis.com/auth/drive',
            callback: (response) => {
                if (response.error) {
                    console.error('Error fetching access token:', response.error);
                    return;
                }
                const accessToken = response.access_token;
                localStorage.setItem('googleAccessToken', accessToken); // Store the access token
                onGoogleApiLoaded(accessToken);
            },
        }).requestAccessToken({prompt: 'consent'});
    };
    document.body.appendChild(gisScript);

    // Load the Google API client library and the Google Drive API
    const apiScript = document.createElement('script');
    apiScript.src = "https://apis.google.com/js/api.js";
    apiScript.onload = () => {
        console.log("Google API client loaded.");
        window.gapi.load('client', () => {
            initializeGapiClient();
        });
    };
    document.body.appendChild(apiScript);
};


const initializeGapiClient = async () => {
    try {
        await window.gapi.client.load('https://www.googleapis.com/discovery/v1/apis/drive/v3/rest');
        console.log("Drive API loaded.");
    } catch (error) {
        console.error("Error loading the Google Drive API:", error);
    }
};

const findFileByName = async (fileName, accessToken) => {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='${fileName}' and trashed=false`, {
        headers: new Headers({ 'Authorization': 'Bearer ' + accessToken })
    });
    const result = await response.json();
    return result.files.length > 0 ? result.files[0] : null; // returns the first found file or null
};

export const uploadFileToGoogleDrive = async (blob, fileName, accessToken, onSuccess, onError) => {
    try {
        const existingFile = await findFileByName(fileName, accessToken);

        const metadata = {
            name: fileName,
            mimeType: 'application/octet-stream'
        };
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', blob);

        let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
        let method = 'POST';

        // If file exists, modify URL to update the file
        if (existingFile) {
            url = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart`;
            method = 'PATCH'; // Use PATCH to update the existing file
        }

        const response = await fetch(url, {
            method: method,
            headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
            body: form,
        });
        const result = await response.json();
        if (response.ok) {
            onSuccess(result);
            alert(fileName + " has been successfully saved");
        } else {
            throw new Error(result.error.message);
        }
    } catch (error) {
        onError(error);
        console.error('Failed to upload file:', error);
    }
};