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
  stationDiv.classList.add("viewCurrentlyPlayingTrack");

  stationDiv.innerHTML = `
        <h2 style="margin : 5px; margin-bottom: 15px;"> 
            <span class="material-symbols-rounded" >
                radio
            </span>
            ${stationName}
        </h2> 
                        <span style="margin-left: 15px" class="radioStatus"></span>
                    

    `;

  const radioStatusElement = stationDiv.querySelector(".radioStatus");

  radioStatusElement.textContent = `${Math.round(
    (trackObject.track.position / trackObject.track.duration) * 100
  )}% though ${trackObject.track.title} by ${
    trackObject.track.author
  } | Currently ${trackObject.currentSegment.position}s (${Math.round(
    (trackObject.currentSegment.position /
      trackObject.currentSegment.duration) *
      100
  )}%) into segment ${trackObject.track.numCurrentSegment} (of ${
    trackObject.track.numSegments
  })`;

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

document.getElementById("submit").onclick = () => {
  setData(
    "FreshlyUploadedMP3File",
    document.getElementById("trackFileInput").files[0],
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
                title: document.getElementById("trackTitleInput").value,
                author: document.getElementById("trackAuthorInput").value,
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
                .then((responseData) =>
                  console.log("Server Response:", responseData)
                )
                .catch((error) =>
                  console.error("Error sending data to server:", error)
                );
            })
            .catch((error) =>
              console.error("Error playing or getting duration:", error)
            );
        })
        .catch((error) => console.error("Error getting download URL:", error));
    }
  );
};
