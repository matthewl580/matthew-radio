function createStationUI(title, desc, logoLink, availableToPlay, stationName) { // Add stationName parameter
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
    "https://cdn.glitch.global/f81e375a-f3b2-430f-9115-3f352b74f21b/WR Substation Icon.png?v=1716472186074",
    true,
    "Radio Wildflower" // Add station name
);

createStationUI(
    "Legion Lofi",
    "Rally behind this air force style Lofi Metal.",
    "https://cdn.glitch.global/f81e375a-f3b2-430f-9115-3f352b74f21b/WR Substation Icon.png?v=1716472186074", // Replace with actual logo
    true,
    "Legion Lofi"  // Add station name
);
createStationUI(
    "Alarm Hub",
    "Literally just alarms",
    "https://cdn.glitch.global/f81e375a-f3b2-430f-9115-3f352b74f21b/WR Substation Icon.png?v=1716472186074", // Replace with actual logo
    true,
    "Alarm Hub"  // Add station name
);
createStationUI(
    "Hue Jazz",
    "Colors and shades of Jazz, from the blues to... the other ones.",
    "https://cdn.glitch.global/f81e375a-f3b2-430f-9115-3f352b74f21b/WR Substation Icon.png?v=1716472186074", // Replace with actual logo
    true,
    "Hue Jazz"  // Add station name
);
createStationUI(
    "Meet Mindseye",
    "Meet Mineseye, a New Zealand-based record producer, visual artist, and DJ with Dutch roots.",
    "https://cdn.glitch.global/f81e375a-f3b2-430f-9115-3f352b74f21b/WR Substation Icon.png?v=1716472186074", // Replace with actual logo
    true,
    "Meet Mindseye"  // Add station name
);
createStationUI(
    "Motivational Melodies",
    "All the motivation, without all the lyrics! Time to get it done!",
    "https://cdn.glitch.global/f81e375a-f3b2-430f-9115-3f352b74f21b/WR Substation Icon.png?v=1716472186074", // Replace with actual logo
    true,
    "Motivational Melodies"  // Add station name
);
createStationUI(
    "Background Rock",
    "Corporate background pop gets a taste of energy... with a side of electric guitar!",
    "https://cdn.glitch.global/f81e375a-f3b2-430f-9115-3f352b74f21b/WR Substation Icon.png?v=1716472186074", // Replace with actual logo
    true,
    "Background Rock"  // Add station name
);
async function fetchDataFromServer(linkEnding, callback = () => { }) {
    fetch(`https://wildflower-radio-zj59.onrender.com${linkEnding}`)
        .then((response) => response.json()) // Parse response as JSON directly
        .then((data) => {
            console.log(data);
            callback(data); // Call callback with the JSON data
            return data;
        })
        .catch((err) => {
            console.error(err);
        });
}

async function getAllTrackInformation(func = () => { }) { // Renamed for clarity
    fetchDataFromServer("/getAllTrackInformation", func);
}

// ... (getTrackPosition remains removed)


var audioElement = document.getElementById("audio");

audioElement.onended = function () {
    getAllTrackInformation((allTrackObjects) => {  // Get all track info
        console.log("Segment ended");

        // Find the currently playing track.  Important: This assumes only ONE station can play at a time.
        // If you want multiple stations to play at the same time, this will need to be changed.
        let currentStationName = document.getElementById("trackName").dataset.station; //Get station name from trackName element
        let trackObject = allTrackObjects[currentStationName];

        if (trackObject) { //Check if trackObject is defined
            populateUI(trackObject, currentStationName); //Pass station name to populateUI
            playSegment(trackObject);
        }

    });
};

function tuneIn(substationName) {
    getAllTrackInformation((allTrackObjects) => { // Get all track info
        let trackObject = allTrackObjects[substationName]; // Get track object for the selected station
        if (trackObject) { //Check if trackObject is defined
            console.log(trackObject);
            populateUI(trackObject, substationName); //Pass station name to populateUI
            playSegment(trackObject);

            // Update UI periodically (but only for the tuned-in station)
            clearInterval(uiUpdateInterval); // Clear any existing interval
            uiUpdateInterval = setInterval(function () {
                getAllTrackInformation((updatedTrackObjects) => {
                    let updatedTrackObject = updatedTrackObjects[substationName];
                    if (updatedTrackObject) { //Check if updatedTrackObject is defined
                        populateUI(updatedTrackObject, substationName);
                    }
                });
            }, 1000);
        } else {
            console.error(`Track object not found for station: ${substationName}`);
        }
    });
}

let uiUpdateInterval; // Store the interval ID

function populateUI(trackObject, stationName) { // Add stationName parameter
    document.getElementById("trackProgressMeter").value = trackObject.track.position;
    document.getElementById("trackProgressMeter").max = trackObject.track.duration;
    document.getElementById("trackName").textContent = trackObject.track.title;
    document.getElementById("trackAuthor").textContent = trackObject.track.author;
    document.getElementById("trackCurrentPosition").textContent = formatTime(trackObject.track.position);
    document.getElementById("trackDuration").textContent = formatTime(trackObject.track.duration);
    document.getElementById("trackName").dataset.station = stationName; // Store station name as a data attribute
}

function playSegment(trackObject) {
    audioElement.src = trackObject.currentSegment.SRC;
    audioElement.currentTime = trackObject.currentSegment.position;
    audioElement.play();
}

// format the time

function formatTime(time = 0) {
  let sec = time;
  let min = 0;
  let hour = 0;

  min = Math.floor(sec / 60);
  sec = sec % 60;

  hour = Math.floor(min / 60);
  min = min % 60;

  const minStr = min < 10 ? "0" + min : min;
  const secStr = sec < 10 ? "0" + sec : sec;

  return (hour > 0 ? hour + ":" : "") + minStr + ":" + secStr;
}
