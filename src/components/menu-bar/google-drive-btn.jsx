import React, { useState } from 'react';
import useDrivePicker from 'react-google-drive-picker';

const GoogleDrivePickerButton = ({ clientId, developerKey }) => {
  const [openPicker] = useDrivePicker();
  const [tokenInfo, setTokenInfo] = useState(null);

  const handleOpenPicker = () => {
    gapi.load('client:auth2', () => {
      gapi.client
        .init({
          apiKey: clientId,
        })
        .then(() => {
          let token = gapi.auth.getToken();
          setTokenInfo(token);
          const pickerConfig = {
            clientId: clientId,
            developerKey: developerKey,
            viewId: 'DOCS',
            token: token ? token.access_token : null,
            showUploadView: true,
            showUploadFolders: true,
            supportDrives: true,
            multiselect: true,
            callbackFunction: (data) => {
              const elements = Array.from(
                document.getElementsByClassName(
                  'picker-dialog'
                )
              );
              for (let i = 0; i < elements.length; i++) {
                elements[i].style.zIndex = '2000';
              }
              if (data.action === 'picked') {
                if (!token) {
                  token = gapi.auth.getToken();
                  setTokenInfo(token);
                }
                const fetchOptions = {
                  headers: {
                    Authorization: `Bearer ${token.access_token}`,
                  },
                };
                const driveFileUrl = 'https://www.googleapis.com/drive/v3/files';
                
                const fetchPromises = data.docs.map(item =>
                  fetch(`${driveFileUrl}/${item.id}?alt=media`, fetchOptions)
                    .then(response => {
                      if (response.ok) {
                        return response.blob();
                      } else {
                        throw new Error(`Failed to fetch file: ${response.statusText}`);
                      }
                    })
                    .then(fileData => {
                      saveFile(fileData, item.name);
                    })
                    .catch(error => {
                      console.error('Error fetching or saving files:', error);
                    })
                );

                Promise.all(fetchPromises)
                  .then(() => {
                    console.log('All files fetched and saved successfully.');
                  })
                  .catch(error => {
                    console.error('Error fetching or saving files:', error);
                  });
              }
            },
          };
          openPicker(pickerConfig);
        });
    });
  };

  const saveFile = (fileData, fileName) => {
    // Example: Save file to local storage
    const blobURL = URL.createObjectURL(fileData);
    const a = document.createElement('a');
    a.href = blobURL;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return <div onClick={handleOpenPicker}>Open Google Drive</div>;
};

export default GoogleDrivePickerButton;
