// SaveToGoogleDrive.jsx

import React from 'react';
import PropTypes from 'prop-types';
import { saveFileToDrive } from './drive-utils.jsx'; // Make sure this utility module is implemented correctly.

// Helper function for authenticating and saving the file
function authenticateAndSaveFile(clientId, apiKey, fileData, fileName) {
  return new Promise((resolve, reject) => {
    // Load the auth2 library and API client library.
    gapi.load('client:auth2', async () => {
      try {
        // Initialize the Google API client
        await gapi.client.init({
          apiKey: apiKey,
          clientId: clientId,
          discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
          scope: 'https://www.googleapis.com/auth/drive.file'
        });
  
        // Sign in the user if they are not already signed in.
        const GoogleAuth = gapi.auth2.getAuthInstance();
        if (!GoogleAuth.isSignedIn.get()) {
          await GoogleAuth.signIn();
        }
  
        // User is signed in; get the access token
        const accessToken = GoogleAuth.currentUser.get().getAuthResponse().access_token;
  
        // Save the file using the utility function
        await saveFileToDrive(fileData, fileName, accessToken);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

class SaveToGoogleDrive extends React.Component {
  state = {
    isSaving: false,
    error: null,
  };

  handleSaveToDrive = () => {
    const { clientId, apiKey, fileData, fileName } = this.props;
    this.setState({ isSaving: true, error: null });

    authenticateAndSaveFile(clientId, apiKey, fileData, fileName)
      .then(() => {
        this.setState({ isSaving: false });
        console.log('File saved successfully.');
        // You can perform additional actions on success here
      })
      .catch(error => {
        this.setState({ isSaving: false, error });
        console.error('Error saving file to Google Drive:', error);
        // Handle errors here
      });
  }

  render() {
    const { isSaving, error } = this.state;
    return (
      <div>
        <button onClick={this.handleSaveToDrive} disabled={isSaving}>
          {isSaving ? 'Saving to Google Drive...' : 'Save to Google Drive'}
        </button>
        {error && <div>Error: {error.message}</div>}
      </div>
    );
  }
}

SaveToGoogleDrive.propTypes = {
  clientId: PropTypes.string.isRequired,
  apiKey: PropTypes.string.isRequired,
  fileData: PropTypes.instanceOf(ArrayBuffer).isRequired,
  fileName: PropTypes.string.isRequired,
};

export default SaveToGoogleDrive;
