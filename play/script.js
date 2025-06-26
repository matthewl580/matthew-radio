var audioElement = document.getElementById("audio");
var nextAudioElement = new Audio(); // Create a second audio element for preloading
let uiUpdateInterval; // Define uiUpdateInterval in a broader scope

// This object will store the preloaded URL for the next segment of each station.
// This is useful if the user rapidly switches stations, minimizing wait time.
let preloadedNextSegmentSrc = {};

audioElement.onended = function () {
    console.log("Segment ended for current audio element.");
    let currentStationName = document.getElementById("trackName").dataset.station;

    // Before fetching new data, check if the next segment is already preloaded for the current station
    if (preloadedNextSegmentSrc[currentStationName]) {
        console.log("Playing preloaded next segment.");
        audioElement.src = preloadedNextSegmentSrc[currentStationName];
        audioElement.currentTime = 0; // Start from the beginning of the preloaded segment
        audioElement.play();
        // Clear the preloaded SRC as it's now being played, and fetch the *new* next segment
        preloadedNextSegmentSrc[currentStationName] = null; 

        // Now, get the updated track information from the server
        // This will allow us to populate the UI and preload the segment *after* the one we just started playing.
        getAllTrackInformation((allTrackObjects) => {
            let trackObject = allTrackObjects[currentStationName];
            if (trackObject) {
                populateUI(trackObject, currentStationName);
                preloadNextSegment(trackObject, currentStationName);
            } else {
                console.warn(`No updated track object found for ${currentStationName} after segment ended.`);
            }
        });

    } else {
        // If not preloaded, fetch and play the next segment as before
        getAllTrackInformation((allTrackObjects) => {
            let trackObject = allTrackObjects[currentStationName];
            if (trackObject) {
                console.log("Fetching and playing next segment (not preloaded).");
                populateUI(trackObject, currentStationName);
                playSegment(trackObject, currentStationName); // Pass station name here
            } else {
                console.error(`Track object not found for station: ${currentStationName} on segment end.`);
            }
        });
    }
};

function tuneIn(substationName) {
    getAllTrackInformation((allTrackObjects) => {
        let trackObject = allTrackObjects[substationName];
        if (trackObject) {
            console.log(`Tuning into ${substationName}.`);
            populateUI(trackObject, substationName);
            playSegment(trackObject, substationName); // Play the current segment

            // Preload the *next* segment immediately after tuning in and playing the current
            preloadNextSegment(trackObject, substationName);

            // Update UI periodically (but only for the tuned-in station)
            clearInterval(uiUpdateInterval);
            uiUpdateInterval = setInterval(function () {
                getAllTrackInformation((updatedTrackObjects) => {
                    let updatedTrackObject = updatedTrackObjects[substationName];
                    if (updatedTrackObject) {
                        populateUI(updatedTrackObject, substationName);
                        // Re-evaluate preloading in case the next segment URL has changed or to keep the pipeline going
                        preloadNextSegment(updatedTrackObject, substationName); 
                    }
                });
            }, 1000); // Fetch new data and update UI every second
        } else {
            console.error(`Track object not found for station: ${substationName}`);
        }
    });
}

/**
 * Plays the current audio segment.
 * @param {object} trackObject The track object for the current station.
 * @param {string} stationName The name of the current station.
 */
function playSegment(trackObject, stationName) {
    audioElement.src = trackObject.currentSegment.SRC;
    audioElement.currentTime = trackObject.currentSegment.position;
    audioElement.play();
    console.log(`Playing segment: ${trackObject.currentSegment.SRC} from position ${trackObject.currentSegment.position}`);

    // Immediately try to preload the next segment for smooth transitions
    preloadNextSegment(trackObject, stationName);
}

/**
 * Preloads the next audio segment for a given station.
 * @param {object} trackObject The track object for the current station.
 * @param {string} stationName The name of the current station.
 */
function preloadNextSegment(trackObject, stationName) {
    // Determine the index of the next segment based on `numCurrentSegment`
    // Note: `numCurrentSegment` is 1-indexed in your data, so adjust for 0-indexed array access.
    const currentSegmentIndex = trackObject.track.numCurrentSegment; // This is the *number* of the current segment (e.g., 7 for Chunk_7)
    const nextSegmentIndexForSRC = currentSegmentIndex + 1; // This is the *number* of the next segment (e.g., 8 for Chunk_8)

    // Check if there's a next segment to preload
    // `numSegments` is the total count, `numCurrentSegment` is 1-indexed.
    // If currentSegmentIndex (1-indexed) is less than numSegments, there's a next one.
    if (currentSegmentIndex < trackObject.track.numSegments) {
        try {
            const currentSrc = trackObject.currentSegment.SRC;
            const urlParts = currentSrc.split('/');
            const filename = urlParts[urlParts.length - 1]; // e.g., "Chunk_7.mp3?alt=media&token=..."
            const filenameWithoutQuery = filename.split('?')[0]; // e.g., "Chunk_7.mp3"
            
            // Extract the track folder name (e.g., "Call to Fly" from the full SRC)
            const trackFolderMatch = currentSrc.match(/\/Tracks%2F([^%2F]+)%2FChunk/);
            const trackFolderName = trackFolderMatch ? decodeURIComponent(trackFolderMatch[1]) : trackObject.track.title; // Fallback to title if parsing fails

            // Construct the base path up to the track folder
            // Example: "https://firebasestorage.googleapis.com/v0/b/matthew-internet-radio.appspot.com/o/Tracks%2FCall%20to%20Fly%2F"
            // Rebuild the path segment by segment to be robust
            const baseUrl = urlParts.slice(0, urlParts.indexOf('Tracks') + 1).join('/');
            const trackPathEncoded = encodeURIComponent(trackFolderName);

            // Assuming the token remains the same for segments of the same track
            const tokenMatch = currentSrc.match(/\?alt=media&token=([a-f0-9-]+)/);
            const token = tokenMatch ? `?alt=media&token=${tokenMatch[1]}` : '';

            const nextSegmentSrc = `${baseUrl}/${trackPathEncoded}%2FChunk_${nextSegmentIndexForSRC}.mp3${token}`;

            // Only preload if the next segment is different from what's currently playing
            // and different from what's already slated for preload for this station.
            if (nextSegmentSrc !== audioElement.src && nextSegmentSrc !== preloadedNextSegmentSrc[stationName]) {
                console.log(`Preloading next segment for ${stationName}: ${nextSegmentSrc}`);
                // Set the SRC for the dedicated preloader element
                nextAudioElement.src = nextSegmentSrc; 
                // Store the preloaded SRC so `onended` can access it
                preloadedNextSegmentSrc[stationName] = nextSegmentSrc; 
            } else {
                // console.log(`Skipping preload for ${stationName}: Next segment already playing or preloaded.`);
            }

        } catch (e) {
            console.error("Error constructing next segment SRC:", e);
        }
    } else {
        console.log(`No next segment to preload for ${stationName}. This is the last segment.`);
        preloadedNextSegmentSrc[stationName] = null; // Clear preloaded if it was the last segment
    }
}


// --- Your existing functions below, with minor adjustments for consistency ---

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

// Example usage (add more stations as needed)
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
async function fetchDataFromServer(linkEnding, callback = () => { }) {
    fetch(`https://wildflower-radio-zj59.onrender.com${linkEnding}`)
        .then((response) => response.json()) 
        .then((data) => {
            console.log("Fetched data:", data); // More descriptive log
            callback(data); 
            return data;
        })
        .catch((err) => {
            console.error("Error fetching data:", err); // More descriptive error
        });
}

async function getAllTrackInformation(func = () => { }) { 
    fetchDataFromServer("/getAllTrackInformation", func);
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
    sec = Math.floor(sec % 60); // Ensure seconds are an integer

    hour = Math.floor(min / 60);
    min = min % 60;

    const minStr = min < 10 ? "0" + min : min;
    const secStr = sec < 10 ? "0" + sec : sec;

    return (hour > 0 ? hour + ":" : "") + minStr + ":" + secStr;
}

// Initial call to set up the stations on page load
async function getAllTrackInformation(func = () => { }) { // Renamed for clarity

    fetchDataFromServer("/getAllTrackInformation", func);

}