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

  // Create tracklist container and editing UI
  const trackListContainer = document.createElement('div');
  trackListContainer.className = 'station-tracklist-container';

  // Defensive extraction of a station track list from several possible shapes
  const extractTrackList = (obj) => {
    if (!obj) return [];
    const candidates = [
      obj.trackList,
      obj.tracklist,
      obj.queue,
      obj.playlist,
      obj.tracks,
      obj.trackArray,
      obj.trackNames,
    ];

    for (const c of candidates) {
      if (!c) continue;
      if (Array.isArray(c)) return c.map(item => {
        if (typeof item === 'string') return item;
        if (item && item.title) return item.title;
        if (item && item.track && item.track.title) return item.track.title;
        return String(item);
      });
      if (typeof c === 'object') {
        // object might be map of id->track
        return Object.values(c).map(item => item && item.title ? item.title : (item && item.track && item.track.title ? item.track.title : String(item)));
      }
      if (typeof c === 'string') return [c];
    }

    // Fallback to the current track if available
    if (obj.track && obj.track.title) return [obj.track.title];
    return [];
  };

  const currentList = extractTrackList(trackObject);

  // Tracklist title + list
  const listTitle = document.createElement('div');
  listTitle.className = 'tracklist-title';
  listTitle.textContent = 'Station Tracklist';

  const ul = document.createElement('ul');
  ul.className = 'station-tracklist';
  ul.id = `tracklist-${stationName}`;

  const renderList = (arr) => {
    ul.innerHTML = '';
    arr.forEach((t, idx) => {
      const li = document.createElement('li');
      li.className = 'tracklist-item';
      li.dataset.index = idx;
      li.innerHTML = `
        <span class="track-name">${t}</span>
        <button class="delete-track" data-index="${idx}" title="Delete track">🗑️</button>
      `;
      ul.appendChild(li);
    });
  };

  renderList(currentList);

  // Add controls: select available server tracks and add button
  const controls = document.createElement('div');
  controls.className = 'tracklist-controls';

  const select = document.createElement('select');
  select.className = 'add-track-select';
  select.id = `add-select-${stationName}`;
  const addBtn = document.createElement('button');
  addBtn.className = 'add-track-button';
  addBtn.textContent = 'Add Track';

  controls.appendChild(select);
  controls.appendChild(addBtn);

  trackListContainer.appendChild(listTitle);
  trackListContainer.appendChild(ul);
  trackListContainer.appendChild(controls);

  stationDiv.appendChild(trackListContainer);

  // Populate the select with tracks from server (cached)
  fetchServerTrackNames().then((names) => {
    // clear and add default
    select.innerHTML = '';
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = '-- select track --';
    select.appendChild(emptyOption);
    names.forEach(n => {
      const o = document.createElement('option');
      o.value = n;
      o.textContent = n;
      select.appendChild(o);
    });
  }).catch(err => {
    // leave select empty and show placeholder option
    select.innerHTML = '';
    const o = document.createElement('option');
    o.value = '';
    o.textContent = 'Could not load server tracks';
    select.appendChild(o);
  });

  // Handlers: delete track
  ul.addEventListener('click', async (ev) => {
    const del = ev.target.closest('.delete-track');
    if (!del) return;
    const idx = Number(del.dataset.index);
    if (Number.isNaN(idx)) return;
    const updated = currentList.slice();
    const removed = updated.splice(idx, 1);
    // update UI immediately
    renderList(updated);
    // send update to server
    try {
      const resp = await updateTrackListOnServer(stationName, updated);
      if (resp && resp.success) {
        showSuccess(`Removed track: ${removed[0]}`);
        // update our local copy
        currentList.splice(idx, 1);
      } else {
        showError('Failed to update server track list.');
        // revert UI
        renderList(currentList);
      }
    } catch (err) {
      showError('Error updating server track list.');
      renderList(currentList);
    }
  });

  // Handler: add track from select
  addBtn.addEventListener('click', async () => {
    const chosen = select.value;
    if (!chosen) {
      showError('Please select a track to add.');
      return;
    }
    // prevent duplicates in list
    if (currentList.includes(chosen)) {
      showError('Track already in the station list.');
      return;
    }
    const updated = currentList.concat([chosen]);
    renderList(updated);
    try {
      const resp = await updateTrackListOnServer(stationName, updated);
      if (resp && resp.success) {
        showSuccess(`Added track: ${chosen}`);
        currentList.push(chosen);
      } else {
        showError('Failed to update server track list.');
        renderList(currentList);
      }
    } catch (err) {
      showError('Error updating server track list.');
      renderList(currentList);
    }
  });

  return stationDiv;
}

// Cache for server track names
let _serverTrackNamesCache = null;
async function fetchServerTrackNames() {
  if (_serverTrackNamesCache) return _serverTrackNamesCache;
  const resp = await fetch('https://wildflower-radio-zj59.onrender.com/getAllTracks');
  if (!resp.ok) throw new Error(`Failed to load tracks: ${resp.status}`);
  const data = await resp.json();
  // normalize to array of strings
  let names = [];
  if (Array.isArray(data)) {
    names = data.map(t => typeof t === 'string' ? t : (t.title || (t.track && t.track.title) || ''))
      .filter(Boolean);
  } else if (data && typeof data === 'object') {
    names = Object.values(data).map(t => typeof t === 'string' ? t : (t.title || (t.track && t.track.title) || '')).filter(Boolean);
  }
  _serverTrackNamesCache = names;
  return names;
}

// Send updated track list for station to server
async function updateTrackListOnServer(stationName, trackList) {
  const body = { stationName, trackList };
  const resp = await fetch('https://wildflower-radio-zj59.onrender.com/admin/editTrackList', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    return { success: false, status: resp.status };
  }
  try {
    const data = await resp.json();
    return { success: true, data };
  } catch (e) {
    return { success: true };
  }
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

// Basic input cleaning: normalize, collapse multiple whitespace to single space, trim ends
function cleanString(input) {
  if (input === undefined || input === null) return '';
  try {
    // Normalize unicode and collapse all whitespace sequences to a single space
    return input
      .toString()
      .normalize()
      .replace(/\s+/g, ' ')
      .trim();
  } catch (e) {
    return input.toString().replace(/\s+/g, ' ').trim();
  }
}

// Check server for duplicate tracks by title+author (case-insensitive)
async function isDuplicateTrack(title, author) {
  try {
    const resp = await fetch('https://wildflower-radio-zj59.onrender.com/getAllTracks');
    if (!resp.ok) {
      return { error: true, message: `Server returned ${resp.status}` };
    }
    const data = await resp.json();

    // Normalize data to an array of track-like objects
    let tracks = [];
    if (Array.isArray(data)) tracks = data;
    else if (data && typeof data === 'object') tracks = Object.values(data);

    const norm = (s) => (s || '').toString().toLowerCase().trim();
    const tNorm = norm(title);
    const aNorm = norm(author);

    for (const tr of tracks) {
      // Support different shapes: { title, author } or { track: { title, author } }
      const trTitle = norm(tr.title || (tr.track && tr.track.title) || tr.name || '');
      const trAuthor = norm(tr.author || (tr.track && tr.track.author) || tr.artist || '');
      if (trTitle === tNorm && trAuthor === aNorm) {
        return { duplicate: true, track: tr };
      }
    }

    return { duplicate: false };
  } catch (err) {
    return { error: true, message: err && err.message ? err.message : String(err) };
  }
}

document.getElementById("submit").onclick = async (e) => {
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
  
  // Clean inputs (trim ends and collapse internal whitespace)
  const title = cleanString(titleInput.value);
  const author = cleanString(authorInput.value);

  // Check for duplicates on server
  try {
    // Optionally disable submit while checking
    const submitBtn = document.getElementById('submit');
    if (submitBtn) submitBtn.disabled = true;

    const dupResult = await isDuplicateTrack(title, author);
    if (dupResult.error) {
      if (submitBtn) submitBtn.disabled = false;
      showError(`Could not verify existing tracks: ${dupResult.message}`);
      return;
    }
    if (dupResult.duplicate) {
      if (submitBtn) submitBtn.disabled = false;
      showError(`Track already exists on server: "${title}" by "${author}".`);
      return;
    }
  } catch (err) {
    const submitBtn = document.getElementById('submit');
    if (submitBtn) submitBtn.disabled = false;
    showError('Error checking for duplicates. Please try again.');
    return;
  }
  
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
                  const submitBtn = document.getElementById('submit');
                  if (submitBtn) submitBtn.disabled = false;
                })
                .catch((error) => {
                  console.error("Error sending data to server:", error);
                  showError("Failed to add track. Please try again.");
                  const submitBtn = document.getElementById('submit');
                  if (submitBtn) submitBtn.disabled = false;
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
