const firebaseConfig = {
  apiKey: "AIzaSyDb1QamdgLbPwmf5vT5_f76q65Qe9gvSjk",
  authDomain: "matthew-internet-radio.firebaseapp.com",
  projectId: "matthew-internet-radio",
  storageBucket: "matthew-internet-radio.appspot.com",
  messagingSenderId: "G-255690604474",
  appId: "1:255690604474:web:734de292b72a8a20b0a783",
  measurementId: "G-PNTKZ9HR35",
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-analytics.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-storage.js";

firebase.initializeApp(firebaseConfig);
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
//const storage = getStorage(app);
const storage = firebase.storage();

function getData(fileName, userCode, func = () => {}) {
  const storageRef = storage.ref(`/Users/${userCode}`);
  storageRef
    .child(fileName)
    .getDownloadURL()
    .then((url) => {
      fetch(url)
        .then((response) => response.text())
        .then((data) => {
          func(data);
          return data;
        });
    })
    .catch((error) => {
      func(undefined);
      return undefined;
    });
}

function setData(fileName, data, func = () => {}) {
  const storageRef = storage.ref(`/Tracks/`);
  storageRef
    .child(fileName)
    .put(data)
    .then((snapshot) => {
      func(snapshot);
      console.log("Uploaded a raw string!");
    });
}

document.body.onload = () => {
  populateRadioStationList();
  setInterval(populateRadioStationList, 3000);
};

function populateRadioStationList() {
  fetch("https://wildflower-radio-zj59.onrender.com/getAllTrackInformation")
    .then((response) => response.json())
    .then((trackObjects) => {
      const stationListContainer = document.getElementById("radioStationList");
      stationListContainer.innerHTML = ""; // Clear existing items

      for (const stationName in trackObjects) {
        if (trackObjects.hasOwnProperty(stationName)) {
          const trackObject = trackObjects[stationName];
          const stationDiv = createStationDiv(stationName, trackObject);
          stationListContainer.appendChild(stationDiv);
        }
      }
    })
    .catch((error) => {
      console.error("Error fetching or parsing track information:", error);
    });
}

function createStationDiv(stationName, trackObject) {
  console.log(trackObject);
  const stationDiv = document.createElement("div");
  stationDiv.classList.add("trackInfo");

  const progressPercent = Math.round((trackObject.track.position / trackObject.track.duration) * 100);
  const segmentProgress = Math.round((trackObject.currentSegment.position / trackObject.currentSegment.duration) * 100);

  stationDiv.innerHTML = `
    <div class="station-header">
      <span class="material-symbols-rounded">radio</span>
      <span class="station-name">${stationName}</span>
    </div>
    <div class="track-details">
      <div class="track-info-row">
        <span class="track-title">${trackObject.track.title}</span>
        <span class="track-author">${trackObject.track.author}</span>
      </div>
      <div class="progress-info">
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${progressPercent}%"></div>
        </div>
        <div class="progress-text">${progressPercent}% complete</div>
      </div>
      <div class="segment-info">
        Segment ${trackObject.track.numCurrentSegment} of ${trackObject.track.numSegments} 
        (${segmentProgress}% complete)
      </div>
    </div>
  `;

  return stationDiv;
}

function populateCurrentTrack(stationName) {
  fetch("https://wildflower-radio-zj59.onrender.com/getAllTrackInformation")
    .then((response) => response.json())
    .then((trackObjects) => {
      const trackObject = trackObjects[stationName];
      if (trackObject) {
        document.getElementsByClassName("radioStatus")[0].textContent = `${
          Math.round(trackObject.track.position / trackObject.track.duration) *
          100
        }% though ${trackObject.track.title} by ${
          trackObject.track.author
        } | Currently ${trackObject.currentSegment.position}s (${
          Math.round(
            trackObject.currentSegment.position /
              trackObject.currentSegment.duration
          ) * 100
        }%) into segment ${trackObject.track.numCurrentSegment} (of ${
          trackObject.track.numSegments
        })`;
      } else {
        console.error("Station not found in track objects.");
      }
    })
    .catch((error) => {
      console.error("Error fetching or parsing track information:", error);
    });
}

function tuneIn(stationName) {
  populateCurrentTrack(stationName);
  // Add any other tune-in logic here (e.g., audio playback)
}

// Validation functions
function validateInput(input) {
  return input.value.trim() !== '';
}

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.value.trim());
}

function validateFile(fileInput) {
  if (!fileInput.files || fileInput.files.length === 0) {
    return false;
  }
  const file = fileInput.files[0];
  return file.type === 'audio/mpeg' || file.type === 'audio/mp3';
}

function showError(message) {
  // Remove existing error messages
  const existingError = document.querySelector('.error-message');
  if (existingError) {
    existingError.remove();
  }
  
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.style.cssText = `
    background: #ffebee;
    color: #c62828;
    padding: 10px;
    border-radius: 5px;
    margin: 10px 0;
    border: 1px solid #ffcdd2;
  `;
  errorDiv.textContent = message;
  
  const form = document.getElementById('addNewTrackForm');
  form.insertBefore(errorDiv, form.firstChild);
}

function showSuccess(message) {
  const successDiv = document.createElement('div');
  successDiv.className = 'success-message';
  successDiv.style.cssText = `
    background: #e8f5e8;
    color: #2e7d32;
    padding: 10px;
    border-radius: 5px;
    margin: 10px 0;
    border: 1px solid #c8e6c9;
  `;
  successDiv.textContent = message;
  
  const form = document.getElementById('addNewTrackForm');
  form.insertBefore(successDiv, form.firstChild);
}

document.getElementById("submit").onclick = (e) => {
  e.preventDefault();
  
  // Remove existing messages
  const existingMessages = document.querySelectorAll('.error-message, .success-message');
  existingMessages.forEach(msg => msg.remove());
  
  // Get form elements
  const titleInput = document.getElementById("trackTitleInput");
  const authorInput = document.getElementById("trackAuthorInput");
  const fileInput = document.getElementById("trackFileInput");
  
  // Validate inputs
  if (!validateInput(titleInput)) {
    showError("Please enter a track title.");
    return;
  }
  
  if (!validateInput(authorInput)) {
    showError("Please enter an artist/author name.");
    return;
  }
  
  if (!validateFile(fileInput)) {
    showError("Please select a valid MP3 file.");
    return;
  }
  
  // Trim whitespace from inputs
  const title = titleInput.value.trim();
  const author = authorInput.value.trim();
  
  setData(
    "FreshlyUploadedMP3File",
    fileInput.files[0],
    (data) => {
      if (!data) return;

      data.ref
        .getDownloadURL()
        .then((downloadURL) => {
          document.getElementById("trackDurationExtractor").src = downloadURL;
          document
            .getElementById("trackDurationExtractor")
            .play()
            .then(() => {
              var dataToSendToServer = {
                downloadURL: downloadURL,
                title: title,
                author: author,
                duration: Math.trunc(
                  document.getElementById("trackDurationExtractor").duration
                ),
                authPassword: "password",
              };
              document.getElementById("trackDurationExtractor").pause();

              fetch("https://wildflower-radio-zj59.onrender.com/addTrack", {
                method: "POST",
                body: JSON.stringify(dataToSendToServer),
                headers: {
                  "Content-type": "application/json; charset=UTF-8",
                },
              })
                .then((response) => response.json())
                .then((responseData) => {
                  console.log("Server Response:", responseData);
                  showSuccess("Track added successfully!");
                  // Clear form
                  titleInput.value = '';
                  authorInput.value = '';
                  fileInput.value = '';
                })
                .catch((error) => {
                  console.error("Error sending data to server:", error);
                  showError("Failed to add track. Please try again.");
                });
            })
            .catch((error) => {
              console.error("Error playing or getting duration:", error);
              showError("Error processing audio file. Please check the file format.");
            });
        })
        .catch((error) => {
          console.error("Error getting download URL:", error);
          showError("Error uploading file. Please try again.");
        });
    }
  );
};
