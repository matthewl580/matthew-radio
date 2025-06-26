var audioElement = document.getElementById("audio");
var nextAudioElement = new Audio(); // Create a second audio element for preloading
let uiUpdateInterval; // Interval for UI updates and continuous data fetching
let preloadedNextSegmentSrc = {}; // Stores the SRC of the *next* segment once preloaded
let currentlyPlayingStation = null; // Track the name of the currently active station

const CLIENT_SERVER_BUFFER_SECONDS = 3; // The desired time difference between client and server playback

audioElement.onended = function () {
    console.log("Segment ended for current audio element.");
    let currentStationName = document.getElementById("trackName").dataset.station;

    // Check if the next segment was already preloaded
    if (preloadedNextSegmentSrc[currentStationName]) {
        console.log(`Playing preloaded next segment for ${currentStationName}.`);
        audioElement.src = preloadedNextSegmentSrc[currentStationName];
        audioElement.currentTime = 0; // Always start preloaded segment from the beginning
        audioElement.play();
        preloadedNextSegmentSrc[currentStationName] = null; // Clear preloaded SRC as it's now playing

        // Immediately fetch new data to get the *next* next segment's info for preloading
        // and update UI with precise server position.
        fetchAndUpdateStationData(currentStationName);

    } else {
        console.warn(`No preloaded segment found for ${currentStationName}. Fetching new data on-demand.`);
        // If not preloaded (e.g., network issue, or initial state),
        // fetch the data immediately and play the new current segment.
        fetchAndUpdateStationData(currentStationName, true); // Pass true to force immediate play
    }
};

/**
 * Fetches updated track information for the specified station and updates the UI/preloading.
 * This function now calls getAllTrackInformation which fetches all data.
 * @param {string} stationName The name of the station to fetch data for.
 * @param {boolean} forcePlay If true, will immediately set the main audio element's SRC and play.
 */
function fetchAndUpdateStationData(stationName, forcePlay = false) {
    getAllTrackInformation((allTrackObjects) => { // This fetches ALL data from the server
        const trackObject = allTrackObjects[stationName];
        if (trackObject) {
            // Always update UI with the server's authoritative data
            populateUI(trackObject, stationName);
            
            // Logic to play the main audio element
            if (forcePlay || (audioElement.src === "" && !audioElement.paused)) { // If nothing is playing or explicitly forced
                console.log(`Setting main audio source to: ${trackObject.currentSegment.SRC}`);
                audioElement.src = trackObject.currentSegment.SRC;
                // Apply the buffer when setting the current time for the main playback
                audioElement.currentTime = Math.max(0, trackObject.currentSegment.position - CLIENT_SERVER_BUFFER_SECONDS);
                audioElement.play();
            }

            // Always attempt to preload the *next* segment based on the fresh server data
            // Only preload if the server's current SRC is different from what's playing or already preloaded
            preloadNextSegment(trackObject.currentSegment.SRC, stationName, audioElement.src, preloadedNextSegmentSrc[stationName]);

        } else {
            console.error(`Track object not found for station: ${stationName} after fetching updated data.`);
        }
    });
}


function tuneIn(substationName) {
    console.log(`Tuning into ${substationName}.`);
    currentlyPlayingStation = substationName; // Keep track of the active station

    clearInterval(uiUpdateInterval); // Clear any existing interval from previous station

    // Initial fetch to get current track info and start playback
    getAllTrackInformation((allTrackObjects) => {
        const trackObject = allTrackObjects[substationName];
        if (trackObject) {
            populateUI(trackObject, substationName);
            audioElement.src = trackObject.currentSegment.SRC;
            // Apply the buffer for the initial playback
            audioElement.currentTime = Math.max(0, trackObject.currentSegment.position - CLIENT_SERVER_BUFFER_SECONDS);
            audioElement.play();
            console.log(`Playing initial segment: ${trackObject.currentSegment.SRC} from position ${audioElement.currentTime.toFixed(2)} (buffered). Server position: ${trackObject.currentSegment.position}`);

            // IMMEDIATELY trigger a second fetch to get the data for the *next* segment for preloading.
            // We pass the currently playing SRC so preloadNextSegment can compare.
            getAllTrackInformation((secondFetchAllTrackObjects) => {
                const secondFetchTrackObject = secondFetchAllTrackObjects[substationName];
                if (secondFetchTrackObject) {
                    // Preload using the SRC from this second fetch
                    // This secondFetchTrackObject.currentSegment.SRC is what the server *currently* sees as next/active
                    preloadNextSegment(secondFetchTrackObject.currentSegment.SRC, substationName, audioElement.src, preloadedNextSegmentSrc[substationName]);
                }
            });

        } else {
            console.error(`Track object not found for station: ${substationName} on tune-in.`);
        }
    });

    // Set up the interval for continuous data fetching and UI updates
    uiUpdateInterval = setInterval(function () {
        // Only fetch and update if there's an active station
        if (currentlyPlayingStation) {
            fetchAndUpdateStationData(currentlyPlayingStation);
        }
    }, 1000); // Fetch new data and update UI every second
}

/**
 * Preloads the next audio segment if the provided serverSRC is different from current or preloaded.
 * @param {string} serverSRC The currentSegment.SRC from the latest server data.
 * @param {string} stationName The name of the current station.
 * @param {string} currentAudioElementSrc The current SRC of the main audio element.
 * @param {string} alreadyPreloadedSrc The SRC already stored in preloadedNextSegmentSrc for this station.
 */
function preloadNextSegment(serverSRC, stationName, currentAudioElementSrc, alreadyPreloadedSrc) {
    if (serverSRC && 
        serverSRC !== currentAudioElementSrc && 
        serverSRC !== alreadyPreloadedSrc) {
        
        console.log(`Preloading ${stationName}'s NEXT segment (from server data): ${serverSRC}`);
        nextAudioElement.src = serverSRC;
        preloadedNextSegmentSrc[stationName] = serverSRC; // Store it for onended
    } else {
        // This might happen if the server hasn't advanced to the next segment yet,
        // or if the segment is already playing/preloaded.
        // console.log(`Skipping preload for ${stationName}. Server SRC: ${serverSRC}, Current: ${currentAudioElementSrc}, Preloaded: ${alreadyPreloadedSrc}`);
    }
}


// --- Your existing functions below ---

async function fetchDataFromServer(linkEnding, callback = () => { }) {
    fetch(`https://wildflower-radio-zj59.onrender.com${linkEnding}`)
        .then((response) => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        }) 
        .then((data) => {
            console.log("Fetched data from server:", data); 
            callback(data); 
        })
        .catch((err) => {
            console.error("Error fetching data from server:", err); 
            callback(null); // Indicate fetch failure
        });
}

// This function can be called whenever, as clarified by the user.
async function getAllTrackInformation(func = () => { }) { 
    fetchDataFromServer("/getAllTrackInformation", func);
}


function createStationUI(title, desc, logoLink, availableToPlay, stationName) { 
    let actionButton = `<div class="tuneInButton" onclick="tuneIn('${stationName}')"> 
        <span class="tuneInButtonIcon material-symbols-rounded">
            play_arrow
        </span>
        <span class="tuneInButtonText">Tune In</span>
    </div>
    `;
    if (!availableToPlay) {
        actionButton = `<div class="tuneInButton"> </div>
            <span class="tuneInButtonIcon material-symbols-rounded">
                signal_disconnected
            </span>
            <span class="tuneInButtonText grayedOut">Unavailable</span>
        </div>`;
    }
    document.getElementById(
        "substationList"
    ).innerHTML += `<div class="substationContainer">
            <div class="substationUIHeader">
                <div class="substationLogoContainer">
                    <img
                        class="substationLogo"
                        src="${logoLink}"
                    />
                </div>
                <div class="substationTitle">${title}</div>
            </div>
            <div class="substationDescription">${desc}</div>
            ${actionButton}
        </div>`;
}

function populateUI(trackObject, stationName) { 
    document.getElementById("trackProgressMeter").value = trackObject.track.position;
    document.getElementById("trackProgressMeter").max = trackObject.track.duration;
    document.getElementById("trackName").textContent = trackObject.track.title;
    document.getElementById("trackAuthor").textContent = trackObject.track.author;
    document.getElementById("trackCurrentPosition").textContent = formatTime(trackObject.track.position);
    document.getElementById("trackDuration").textContent = formatTime(trackObject.track.duration);
    document.getElementById("trackName").dataset.station = stationName; 
}

function formatTime(time = 0) {
    let sec = time;
    let min = 0;
    let hour = 0;

    min = Math.floor(sec / 60);
    sec = Math.floor(sec % 60); 

    hour = Math.floor(min / 60);
    min = min % 60;

    const minStr = min < 10 ? "0" + min : min;
    const secStr = sec < 10 ? "0" + sec : sec;

    return (hour > 0 ? hour + ":" : "") + minStr + ":" + secStr;
}

// Initial setup for the UI when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // These hardcoded calls create the initial station selection UI.
    // In a dynamic scenario, you might call getAllTrackInformation here once
    // to populate these dynamically, but given the existing structure,
    // they remain as is for creating the UI elements themselves.
});

// Hardcoded createStationUI calls as in your original snippet.
createStationUI(
    "Wildflower Radio",
    "The perfect mixing bag. You'll never know what you're going to get!",
    "https://cdn.glitch.global/f81e375a-f3b2-430f-9115-3f352b74f21b/WR%20Substation%20Icon.png?v=1716472186074",
    true,
    "Radio Wildflower" 
);
createStationUI(
    "Legion Lofi",
    "Rally behind this air force style Lofi Metal.",
    "https://cdn.glitch.global/f81e375a-f3b2-430f-9115-3f352b74f21b/WR%20Substation%20Icon.png?v=1716472186074", 
    true,
    "Legion Lofi"  
);
createStationUI(
    "Alarm Hub",
    "Literally just alarms",
    "https://cdn.glitch.global/f81e375a-f3b2-430f-9115-3f352b74f21b/WR%20Substation%20Icon.png?v=1716472186074", 
    true,
    "Alarm Hub"  
);
createStationUI(
    "Hue Jazz",
    "Colors and shades of Jazz, from the blues to... the other ones.",
    "https://cdn.glitch.global/f81e375a-f3b2-430f-9115-3f352b74f21b/WR%20Substation%20Icon.png?v=1716472186074", 
    true,
    "Hue Jazz"  
);
createStationUI(
    "Meet Mindseye",
    "Meet Mineseye, a New Zealand-based record producer, visual artist, and DJ with Dutch roots.",
    "https://cdn.glitch.global/f81e375a-f3b2-430f-9115-3f352b74f21b/WR%20Substation%20Icon.png?v=1716472186074", 
    true,
    "Meet Mindseye"  
);
createStationUI(
    "Motivational Melodies",
    "All the motivation, without all the lyrics! Time to get it done!",
    "https://cdn.glitch.global/f81e375a-f3b2-430f-9115-3f352b74f21b/WR%20Substation%20Icon.png?v=1716472186074", 
    true,
    "Motivational Melodies"  
);
createStationUI(
    "Background Rock",
    "Corporate background pop gets a taste of energy... with a side of electric guitar!",
    "https://cdn.glitch.global/f81e375a-f3b2-430f-9115-3f352b74f21b/WR%20Substation%20Icon.png?v=1716472186074", 
    true,
    "Background Rock"  
);