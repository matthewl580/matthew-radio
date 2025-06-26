var audioElement = document.getElementById("audio");
var nextAudioElement = new Audio(); // Create a second audio element for preloading
let uiUpdateInterval; // Define uiUpdateInterval in a broader scope
let preloadedNextSegmentSrc = {}; // Stores preloaded URL for the next segment of each station.

// Store all track information fetched from the server once a station is tuned in
let allTrackDataClient = {}; 

audioElement.onended = function () {
    console.log("Segment ended for current audio element.");
    let currentStationName = document.getElementById("trackName").dataset.station;

    // Check if the next segment is already preloaded for the current station
    if (preloadedNextSegmentSrc[currentStationName]) {
        console.log("Playing preloaded next segment.");
        audioElement.src = preloadedNextSegmentSrc[currentStationName];
        audioElement.currentTime = 0; // Start from the beginning of the preloaded segment
        audioElement.play();
        // Clear the preloaded SRC as it's now being played
        preloadedNextSegmentSrc[currentStationName] = null; 

        // Update the client-side data to reflect the new current segment
        // Then, fetch the *new* full data from the server to get the *next* next segment's info
        // and update our local store for future reference.
        getAllTrackInformation((allTrackObjects) => { // This will now re-fetch ALL data
            allTrackDataClient = allTrackObjects; // Update our local client store
            let trackObject = allTrackDataClient[currentStationName]; // Get data for the active station
            if (trackObject) {
                populateUI(trackObject, currentStationName);
                preloadNextSegment(trackObject, currentStationName); // Preload the segment *after* the one that just started
            } else {
                console.warn(`No updated track object found for ${currentStationName} after segment ended.`);
            }
        });

    } else {
        // Fallback: If not preloaded, fetch all data and then play
        // This is a less optimized path, but necessary if preloading didn't happen
        getAllTrackInformation((allTrackObjects) => { // Re-fetch ALL data
            allTrackDataClient = allTrackObjects; // Update our local client store
            let trackObject = allTrackDataClient[currentStationName];
            if (trackObject) {
                console.log("Fetching and playing next segment (not preloaded).");
                populateUI(trackObject, currentStationName);
                playSegment(trackObject, currentStationName); 
            } else {
                console.error(`Track object not found for station: ${currentStationName} on segment end.`);
            }
        });
    }
};

function tuneIn(substationName) {
    // Only fetch ALL track information ONCE when tuning into a station
    getAllTrackInformation((allTrackObjects) => { 
        allTrackDataClient = allTrackObjects; // Store the full data locally
        let trackObject = allTrackDataClient[substationName]; // Get track object for the selected station
        if (trackObject) {
            console.log(`Tuning into ${substationName}.`);
            populateUI(trackObject, substationName);
            playSegment(trackObject, substationName); // Play the current segment

            // Preload the *next* segment immediately after tuning in and playing the current
            preloadNextSegment(trackObject, substationName);

            // Update UI periodically (using client-side data for progress)
            clearInterval(uiUpdateInterval);
            uiUpdateInterval = setInterval(function () {
                // Update track position locally based on elapsed time, not new server data
                if (allTrackDataClient[substationName] && audioElement.currentTime) {
                    // Estimate current position within the track based on audio playback
                    // This assumes audio element time is relatively accurate.
                    // A more robust solution might track the actual start time of the segment
                    // and calculate elapsed time from that.
                    let currentSegmentDuration = allTrackDataClient[substationName].currentSegment.duration;
                    let currentSegmentPosition = audioElement.currentTime;
                    let currentTrackPosition = allTrackDataClient[substationName].track.position;
                    
                    // Simple estimation for track position update.
                    // This is imperfect because track.position from server is for the start of the current segment.
                    // For perfect sync, you'd need server to send start timestamp or calculate based on segment durations.
                    // Given the constraint "cannot change data sent from server", we approximate.
                    let newTrackPosition = currentTrackPosition - (allTrackDataClient[substationName].currentSegment.duration - allTrackDataClient[substationName].currentSegment.position) + audioElement.currentTime;

                    // Clamp to prevent exceeding track duration
                    if (newTrackPosition > allTrackDataClient[substationName].track.duration) {
                        newTrackPosition = allTrackDataClient[substationName].track.duration;
                    }

                    allTrackDataClient[substationName].currentSegment.position = currentSegmentPosition;
                    allTrackDataClient[substationName].track.position = newTrackPosition;

                    populateUI(allTrackDataClient[substationName], substationName);
                }
            }, 1000); // Update UI every second based on client-side data
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
    const currentSegmentIndex = trackObject.track.numCurrentSegment; 
    const nextSegmentIndexForSRC = currentSegmentIndex + 1; 

    if (currentSegmentIndex < trackObject.track.numSegments) {
        try {
            const currentSrc = trackObject.currentSegment.SRC;
            const urlParts = currentSrc.split('/');
            
            // Extract the track folder name
            const trackFolderMatch = currentSrc.match(/\/Tracks%2F([^%2F]+)%2FChunk/);
            const trackFolderName = trackFolderMatch ? decodeURIComponent(trackFolderMatch[1]) : trackObject.track.title; 

            // Reconstruct base URL up to 'Tracks/'
            const baseUrlParts = urlParts.slice(0, urlParts.indexOf('Tracks') + 1);
            const baseUrl = baseUrlParts.join('/');

            const trackPathEncoded = encodeURIComponent(trackFolderName);

            // Extract the token from the current SRC
            const tokenMatch = currentSrc.match(/\?alt=media&token=([a-f0-9-]+)/);
            const token = tokenMatch ? `?alt=media&token=${tokenMatch[1]}` : '';

            const nextSegmentSrc = `${baseUrl}/${trackPathEncoded}%2FChunk_${nextSegmentIndexForSRC}.mp3${token}`;

            if (nextSegmentSrc !== audioElement.src && nextSegmentSrc !== preloadedNextSegmentSrc[stationName]) {
                console.log(`Preloading next segment for ${stationName}: ${nextSegmentSrc}`);
                nextAudioElement.src = nextSegmentSrc; 
                preloadedNextSegmentSrc[stationName] = nextSegmentSrc; 
            }
        } catch (e) {
            console.error("Error constructing next segment SRC:", e);
        }
    } else {
        console.log(`No next segment to preload for ${stationName}. This is the last segment.`);
        preloadedNextSegmentSrc[stationName] = null; 
    }
}


// --- Your existing functions below, with critical updates for data fetching ---

// This function must now rely on a simulated/cached response
async function fetchDataFromServer(linkEnding, callback = () => { }) {
    // *** IMPORTANT: This entire function is a SIMULATION based on your provided static data. ***
    // *** In a real environment, you would use 'fetch' to hit your actual server endpoint. ***

    const staticData = {
        "Radio Wildflower": { /* ... your provided data ... */
            "currentSegment": {
                "duration": 26,
                "position": 8,
                "SRC": "https://firebasestorage.googleapis.com/v0/b/matthew-internet-radio.appspot.com/o/Tracks%2FCall%20to%20Fly%2FChunk_7.mp3?alt=media&token=5906a672-bd5a-4ef3-b278-7752179a71c5"
            },
            "track": {
                "segmentDurations": [
                    12.669, 24.555, 26.227, 26.227, 26.227, 26.213, 26.227, 26.21, 26.201, 26.201
                ],
                "numSegments": 10,
                "numCurrentSegment": 7,
                "author": "Lofi Metal",
                "title": "Call to Fly",
                "duration": 246,
                "position": 148,
                "SRC": "Tracks/Call to Fly"
            }
        },
        "Alarm Hub": {
            "currentSegment": {
                "duration": 26,
                "position": 2,
                "SRC": "https://firebasestorage.googleapis.com/v0/b/matthew-internet-radio.appspot.com/o/Tracks%2FUntitled%20Alarm%2FChunk_2.mp3?alt=media&token=dff5e2ec-ad57-4d1e-b235-09f716a0db00"
            },
            "track": {
                "segmentDurations": [
                    26.227, 26.227, 26.227, 1.926, 26.279, 26.201
                ],
                "numSegments": 6,
                "numCurrentSegment": 2,
                "author": "venom-man",
                "title": "Untitled Alarm",
                "duration": 132,
                "position": 28,
                "SRC": "Tracks/Untitled Alarm"
            }
        },
        "Legion Lofi": {
            "currentSegment": {
                "duration": 32,
                "position": 2,
                "SRC": "https://firebasestorage.googleapis.com/v0/b/matthew-internet-radio.appspot.com/o/Tracks%2FBurning%20Sky%2FChunk_6.mp3?alt=media&token=d1792116-4ea1-46ac-84b6-e95562334db4"
            },
            "track": {
                "segmentDurations": [
                    3.187, 32.784, 32.784, 32.758, 32.743, 32.758
                ],
                "numSegments": 6,
                "numCurrentSegment": 6,
                "author": "Lofi Metal",
                "title": "Burning Sky",
                "duration": 167,
                "position": 133,
                "SRC": "Tracks/Burning Sky"
            }
        },
        "Hue Jazz": {
            "currentSegment": {
                "duration": 30,
                "position": 4,
                "SRC": "https://firebasestorage.googleapis.com/v0/b/matthew-internet-radio.appspot.com/o/Tracks%2FSoul%20of%20Galveston%2FChunk_4.mp3?alt=media&token=29f9cbe9-fc80-459b-921f-c660f5c65251"
            },
            "track": {
                "segmentDurations": [
                    43.536, 43.704, 43.68, 30
                ],
                "numSegments": 4,
                "numCurrentSegment": 4,
                "author": "Revolutionary Tunes",
                "title": "Soul of Galveston",
                "duration": 162,
                "position": 133,
                "SRC": "Tracks/Soul of Galveston"
            }
        },
        "Meet Mindseye": {
            "currentSegment": {
                "duration": 29,
                "position": 20,
                "SRC": "https://firebasestorage.googleapis.com/v0/b/matthew-internet-radio.appspot.com/o/Tracks%2FMindseye%20-%20Atlantic%2FChunk_4.mp3?alt=media&token=71d041a8-f6ee-4ccf-af66-be2439fc5053"
            },
            "track": {
                "segmentDurations": [
                    1, 29.884, 28.4, 29.936, 29.283, 25.783, 25.783, 25.809, 25.783, 25.765
                ],
                "numSegments": 9,
                "numCurrentSegment": 4,
                "author": "Mindseye",
                "title": "Mindseye - Atlantic",
                "duration": 164,
                "position": 78,
                "SRC": "Tracks/Mindseye - Atlantic"
            }
        },
        "Motivational Melodies": {
            "currentSegment": {
                "duration": 10,
                "position": 4,
                "SRC": "https://firebasestorage.googleapis.com/v0/b/matthew-internet-radio.appspot.com/o/Tracks%2FEvolution%2FChunk_4.mp3?alt=media&token=bd27edac-be93-45af-8595-fd91259373f2"
            },
            "track": {
                "segmentDurations": [
                    1.672, 10.945, 10.945, 10.928, 10.919, 10.919, 10.919, 10.919, 10.919, 10.919, 10.919, 10.919, 10.919, 10.919, 10.919, 10.902
                ],
                "numSegments": 16,
                "numCurrentSegment": 4,
                "author": "Bensound.com",
                "title": "Evolution",
                "duration": 165,
                "position": 25,
                "SRC": "Tracks/Evolution"
            }
        },
        "Background Rock": {
            "currentSegment": {
                "duration": 6,
                "position": 4,
                "SRC": "https://firebasestorage.googleapis.com/v0/b/matthew-internet-radio.appspot.com/o/Tracks%2FCool%20Rock%2FChunk_24.mp3?alt=media&token=5fd6a0a8-f49e-4d2b-8959-8ae68d87c40d"
            },
            "track": {
                "segmentDurations": [
                    6.557, 6.557, 6.557, 5.695, 6.557, 6.557, 6.565, 6.557, 6.557, 6.557, 6.557, 6.557, 6.557, 6.543, 6.557, 6.557, 6.557, 6.557, 6.557, 6.557, 6.557, 6.531, 6.531, 6.533
                ],
                "numSegments": 24,
                "numCurrentSegment": 24,
                "author": "Pufino",
                "title": "Cool Rock",
                "duration": 156,
                "position": 141,
                "SRC": "Tracks/Cool Rock"
            }
        }
    };
    
    // In your real application, you would uncomment and use your actual fetch call:
    fetch(`https://wildflower-radio-zj59.onrender.com${linkEnding}`)
        .then((response) => response.json()) 
        .then((data) => {
            console.log("Fetched data from server:", data); 
            callback(data); 
        })
        .catch((err) => {
            console.error("Error fetching data from server:", err); 
            callback(null); // Indicate fetch failure
        });

    // // FOR SIMULATION ONLY (remove this in production if you use the actual fetch above)
    // setTimeout(() => {
    //     console.log("Simulating server response for:", linkEnding);
    //     if (linkEnding === "/getAllTrackInformation") {
    //         callback(staticData);
    //     } else {
    //         console.warn(`Simulated fetch: Unknown link ending: ${linkEnding}. Returning full staticData.`);
    //         callback(staticData); // Fallback for simulation, in real app this would be an error
    //     }
    // }, 100); 
}

// This function should ONLY be called ONCE when the app loads or station list needs refreshing.
// You explicitly stated this definition cannot change.
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

// Initial setup to populate the station list when the page loads
// This is the ideal place to call getAllTrackInformation once for initial UI display.
document.addEventListener('DOMContentLoaded', () => {
    // You should still call this once to populate the list of available stations.
    // However, the `tuneIn` function will handle the primary `getAllTrackInformation` call.
    // For the initial list display, you'd need to mock or ensure the server data is available for descriptions/logos.
    // Since createStationUI is called directly below, this block is mostly illustrative
    // of where you'd parse `allTrackObjects` to build the UI dynamically if it wasn't hardcoded.
    console.log("DOM Content Loaded. Initializing station display.");

    // This section would typically be dynamic based on getAllTrackInformation.
    // For now, it uses your existing hardcoded createStationUI calls.
    // If you want the UI to be built from `allTrackObjects` dynamically,
    // uncomment and modify the block below and remove the hardcoded createStationUI calls.

    /*
    getAllTrackInformation((allTrackObjects) => {
        for (const stationName in allTrackObjects) {
            if (allTrackObjects.hasOwnProperty(stationName)) {
                const stationData = allTrackObjects[stationName];
                // You'll need descriptions and logo links in your initial getAllTrackInformation response
                // or have a mapping on the client side.
                const desc = "A radio station description"; // Placeholder
                const logoLink = "https://cdn.glitch.global/f81e375a-f3b2-430f-9115-3f352b74f21b/WR%20Substation%20Icon.png?v=1716472186074"; // Placeholder
                createStationUI(stationData.track.title, desc, logoLink, true, stationName);
            }
        }
    });
    */
});


// Hardcoded createStationUI calls as in your original snippet.
// These should ideally be driven by the getAllTrackInformation callback on DOMContentLoaded
// if you want your station list to be dynamic from the server.
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