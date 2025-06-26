var audioElement = document.getElementById("audio");
var nextAudioElement = new Audio(); // Create a second audio element for preloading
let uiUpdateInterval; // Interval for UI updates and continuous data fetching
let preloadedNextSegmentSrc = {}; // Stores the SRC of the *next* segment once preloaded
let currentlyPlayingStation = null; // Track the name of the currently active station

// Client-side tracking for UI display
let clientAccumulatedSegmentDuration = 0; // Sum of durations of segments *already played* by client
let currentStationServerData = null; // Store the last complete server data for current station

const CLIENT_SERVER_BUFFER_SECONDS = 3; // The desired time difference between client and server playback
const SMOOTH_TRANSITION_WINDOW = 0.5; // Seconds before segment end to perform a seamless switch

// Listener for main audio element's time updates
audioElement.ontimeupdate = function () {
    if (!currentlyPlayingStation || !currentStationServerData) return;

    // --- 1. Update Client-Side UI ---
    // Calculate client's overall track position based on current segment and already played segments
    const currentSegmentIndex = currentStationServerData.track.numCurrentSegment;
    let effectiveAccumulatedDuration = 0;
    for (let i = 0; i < currentSegmentIndex; i++) { // Sum durations of segments *before* the current one
        if (currentStationServerData.track.segmentDurations[i]) {
            effectiveAccumulatedDuration += currentStationServerData.track.segmentDurations[i];
        }
    }
    const clientTrackPosition = effectiveAccumulatedDuration + audioElement.currentTime;
    
    document.getElementById("trackProgressMeter").value = clientTrackPosition;
    document.getElementById("trackProgressMeter").max = currentStationServerData.track.duration; // Max from server
    document.getElementById("trackCurrentPosition").textContent = formatTime(clientTrackPosition);
    document.getElementById("trackDuration").textContent = formatTime(currentStationServerData.track.duration); // Duration from server

    // --- 2. Predictive Segment Switch ---
    const timeRemainingInCurrentSegment = audioElement.duration - audioElement.currentTime;

    if (timeRemainingInCurrentSegment <= SMOOTH_TRANSITION_WINDOW && timeRemainingInCurrentSegment > 0) {
        if (preloadedNextSegmentSrc[currentlyPlayingStation] && 
            nextAudioElement.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
            
            console.log(`[ontimeupdate] Smoothly switching to preloaded segment for ${currentlyPlayingStation}.`);
            audioElement.src = preloadedNextSegmentSrc[currentlyPlayingStation];
            audioElement.currentTime = 0; // Start new segment from beginning
            audioElement.play();

            // Clear preloaded SRC and update client-side accumulated duration
            preloadedNextSegmentSrc[currentlyPlayingStation] = null;
            // The segment that just finished was the one *before* the server's numCurrentSegment from the last poll.
            // This requires careful indexing.
            // When we load a new segment from nextAudioElement, the old currentAudioElement.duration is added
            // The logic for clientAccumulatedSegmentDuration needs to be tied to the actual segment playback,
            // not just the server's numCurrentSegment.
            // For simplicity with server as truth: let's recalculate segment index based on client time
            // and use server's segment durations. This is the hardest part of client-server position sync.

            // A simpler approach for client display only: let's trust server's numCurrentSegment and segmentDurations
            // and just update based on the *new* segment that just started.
            // When a segment finishes, the server's 'numCurrentSegment' will eventually increment,
            // and our uiUpdateInterval will pick that up and re-initialize clientAccumulatedSegmentDuration.
            // For immediate client-side update:
            const finishedSegmentDuration = currentStationServerData.track.segmentDurations[currentStationServerData.track.numCurrentSegment -1];
            if (finishedSegmentDuration) {
                clientAccumulatedSegmentDuration += finishedSegmentDuration;
            }


            // Trigger fetch for the *next* next segment after this one
            fetchAndUpdateStationData(currentlyPlayingStation);
        }
    }
};

audioElement.onended = function () {
    console.log("Segment ended for current audio element (fallback triggered).");
    let currentStationName = document.getElementById("trackName").dataset.station;

    // This is a fallback. If ontimeupdate didn't trigger the switch, use onended.
    if (preloadedNextSegmentSrc[currentStationName]) {
        console.log(`[onended] Playing preloaded segment as fallback for ${currentStationName}.`);
        audioElement.src = preloadedNextSegmentSrc[currentStationName];
        audioElement.currentTime = 0;
        audioElement.play();
        preloadedNextSegmentSrc[currentStationName] = null;

        // Update client-side accumulated duration (if not already done by ontimeupdate)
        const finishedSegmentDuration = currentStationServerData.track.segmentDurations[currentStationServerData.track.numCurrentSegment -1];
        if (finishedSegmentDuration) {
            clientAccumulatedSegmentDuration += finishedSegmentDuration;
        }

        fetchAndUpdateStationData(currentStationName); // Get next for preload

    } else {
        console.warn(`[onended] No preloaded segment for ${currentStationName}. Forcing fetch.`);
        fetchAndUpdateStationData(currentStationName, true); // Force fetch and play
    }
};

/**
 * Fetches updated track information for the specified station and updates the UI/preloading.
 * This function now calls getAllTrackInformation which fetches all data.
 * @param {string} stationName The name of the station to fetch data for.
 * @param {boolean} forcePlay If true, will immediately set the main audio element's SRC and play regardless of preload.
 */
function fetchAndUpdateStationData(stationName, forcePlay = false) {
    getAllTrackInformation((allTrackObjects) => { // This fetches ALL data from the server
        const trackObject = allTrackObjects[stationName];
        if (trackObject) {
            currentStationServerData = trackObject; // Always update server data snapshot

            // --- Logic to play the main audio element (only if forced or no audio is currently playing) ---
            if (forcePlay || (audioElement.src === "" && audioElement.paused)) { 
                console.log(`Setting main audio source to: ${trackObject.currentSegment.SRC} (forced/initial).`);
                audioElement.src = trackObject.currentSegment.SRC;
                // Apply the buffer when setting the current time for the main playback
                audioElement.currentTime = Math.max(0, trackObject.currentSegment.position - CLIENT_SERVER_BUFFER_SECONDS);
                audioElement.play();

                // Re-initialize clientAccumulatedSegmentDuration for a new segment/track
                clientAccumulatedSegmentDuration = 0;
                for (let i = 0; i < trackObject.track.numCurrentSegment; i++) { 
                    if (trackObject.track.segmentDurations[i]) {
                        clientAccumulatedSegmentDuration += trackObject.track.segmentDurations[i];
                    }
                }
                // Subtract current segment duration as clientAccumulatedSegmentDuration should be sum of *finished* segments
                clientAccumulatedSegmentDuration -= trackObject.currentSegment.duration; 
                // Ensure it's not negative at start of track
                if (clientAccumulatedSegmentDuration < 0) clientAccumulatedSegmentDuration = 0;
            }

            // --- Always attempt to preload the *next* segment ---
            // Only preload if the server's current SRC is different from what's playing or already preloaded
            preloadNextSegment(trackObject.currentSegment.SRC, stationName);

        } else {
            console.error(`Track object not found for station: ${stationName} after fetching updated data.`);
            // Potentially stop playback or indicate error to user
        }
    });
}


function tuneIn(substationName) {
    console.log(`Tuning into ${substationName}.`);
    currentlyPlayingStation = substationName; // Keep track of the active station

    clearInterval(uiUpdateInterval); // Clear any existing interval from previous station
    audioElement.pause(); // Stop any currently playing audio
    audioElement.src = ""; // Clear current source
    nextAudioElement.src = ""; // Clear preload source
    preloadedNextSegmentSrc[substationName] = null; // Clear preloaded reference
    clientAccumulatedSegmentDuration = 0; // Reset client position

    // Initial fetch to get current track info and start playback
    getAllTrackInformation((allTrackObjects) => {
        const trackObject = allTrackObjects[substationName];
        if (trackObject) {
            currentStationServerData = trackObject; // Store initial server data
            populateUI(trackObject, substationName); // Populate UI with server's initial data

            audioElement.src = trackObject.currentSegment.SRC;
            // Apply the buffer for the initial playback
            audioElement.currentTime = Math.max(0, trackObject.currentSegment.position - CLIENT_SERVER_BUFFER_SECONDS);
            audioElement.play();
            console.log(`Playing initial segment: ${trackObject.currentSegment.SRC} from position ${audioElement.currentTime.toFixed(2)} (buffered). Server position: ${trackObject.currentSegment.position}`);

            // Initialize clientAccumulatedSegmentDuration based on the *starting* segment
            clientAccumulatedSegmentDuration = 0;
            for (let i = 0; i < trackObject.track.numCurrentSegment; i++) {
                 if (trackObject.track.segmentDurations[i]) {
                    clientAccumulatedSegmentDuration += trackObject.track.segmentDurations[i];
                }
            }
            // Subtract current segment duration to reflect sum of *previous* completed segments
            clientAccumulatedSegmentDuration -= trackObject.currentSegment.duration; 
            if (clientAccumulatedSegmentDuration < 0) clientAccumulatedSegmentDuration = 0;


            // IMMEDIATELY trigger a second fetch for the *next* segment's URL for preloading.
            // This is crucial for getting the preload pipeline started right away.
            getAllTrackInformation((secondFetchAllTrackObjects) => {
                const secondFetchTrackObject = secondFetchAllTrackObjects[substationName];
                if (secondFetchTrackObject) {
                    // Preload using the SRC from this second fetch.
                    // This secondFetchTrackObject.currentSegment.SRC is what the server *currently* sees as active/next.
                    preloadNextSegment(secondFetchTrackObject.currentSegment.SRC, substationName);
                }
            });

        } else {
            console.error(`Track object not found for station: ${substationName} on tune-in.`);
            // Handle error: e.g., show "Station Unavailable"
        }
    });

    // Set up the interval for continuous data fetching from server
    // This keeps the server's 'currentStationServerData' updated and triggers preloads.
    uiUpdateInterval = setInterval(function () {
        if (currentlyPlayingStation) {
            fetchAndUpdateStationData(currentlyPlayingStation);
        }
    }, 1000); // Fetch new data every second
}

/**
 * Preloads the next audio segment if the provided serverSRC is genuinely new.
 * @param {string} serverSRC The currentSegment.SRC from the latest server data.
 * @param {string} stationName The name of the current station.
 */
function preloadNextSegment(serverSRC, stationName) {
    if (serverSRC && 
        serverSRC !== audioElement.src && // Not already playing on main element
        serverSRC !== nextAudioElement.src) { // Not already preloaded in nextAudioElement
        
        console.log(`Preloading ${stationName}'s NEXT segment: ${serverSRC}`);
        nextAudioElement.src = serverSRC;
        preloadedNextSegmentSrc[stationName] = serverSRC; // Store it for onended/ontimeupdate switch
    } else {
        // console.log(`Skipping preload for ${stationName}. Server SRC: ${serverSRC} is current or already preloaded.`);
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
            // console.log("Fetched data from server:", data); // Keep this for debugging if needed
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

// populateUI now mainly focuses on static track info, client time is handled by ontimeupdate
function populateUI(trackObject, stationName) { 
    // trackProgressMeter max should be total track duration, which is from server data
    document.getElementById("trackProgressMeter").max = trackObject.track.duration; 
    document.getElementById("trackName").textContent = trackObject.track.title;
    document.getElementById("trackAuthor").textContent = trackObject.track.author;
    document.getElementById("trackDuration").textContent = formatTime(trackObject.track.duration);
    document.getElementById("trackName").dataset.station = stationName; 
    // client-side position is updated by ontimeupdate, not here
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
    // This part remains unchanged as it sets up the static station buttons.
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