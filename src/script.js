let currentEpisodeUrl = "";

const CORS_PROXIES = [
  "https://api.allorigins.win/raw?url=",
  "https://cors.bridged.cc/",
  "https://cors-anywhere.herokuapp.com/",
];
let currentProxyIndex = 0;

const defaultFeeds = [
  { name: "Lateralcast", url: "https://feeds.megaphone.fm/lateralcast" },
  { name: "Colbey", url: "https://media.rss.com/colbey/feed.xml" },
];

let RSS_FEED_URLS =
  JSON.parse(localStorage.getItem("userFeeds")) || defaultFeeds;

document.addEventListener("DOMContentLoaded", () => {
  populateFeedSelector();
  document
    .getElementById("feedSelector")
    .addEventListener("change", fetchSelectedFeed);
  fetchSelectedFeed();
});

function getNextProxy() {
  currentProxyIndex = (currentProxyIndex + 1) % CORS_PROXIES.length;
  return CORS_PROXIES[currentProxyIndex];
}

function addFeed() {
  const name = document.getElementById("feedName").value.trim();
  const url = document.getElementById("feedUrl").value.trim();

  if (name && url) {
    RSS_FEED_URLS.push({ name, url });
    localStorage.setItem("userFeeds", JSON.stringify(RSS_FEED_URLS));
    populateFeedSelector();
    document.getElementById("feedName").value = "";
    document.getElementById("feedUrl").value = "";
  } else {
    alert("Please provide both name and URL for the feed.");
  }

  fetchSelectedFeed();
}

function removeCurrentFeed() {
  const selectedIndex = document.getElementById("feedSelector").value;

  const confirmRemove = confirm(
    `Are you sure you want to remove "${RSS_FEED_URLS[selectedIndex].name}" feed?`
  );
  if (!confirmRemove) {
    return;
  }

  if (selectedIndex >= 0) {
    RSS_FEED_URLS.splice(selectedIndex, 1);
    localStorage.setItem("userFeeds", JSON.stringify(RSS_FEED_URLS));
    populateFeedSelector();

    if (RSS_FEED_URLS.length > 0) {
      document.getElementById("feedSelector").value = 0;
      fetchSelectedFeed();
    } else {
      document.getElementById("episodesList").innerHTML =
        "No feeds available. Please add a new feed.";
    }
  }

  populateFeedSelector();
  fetchSelectedFeed();
}

function populateFeedSelector() {
  const feedSelector = document.getElementById("feedSelector");
  feedSelector.innerHTML = ""; // Clear existing options
  RSS_FEED_URLS.forEach((feed, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = feed.name;
    feedSelector.appendChild(option);
  });
}

async function fetchSelectedFeed() {
  const selectedIndex = document.getElementById("feedSelector").value;
  const selectedFeed = RSS_FEED_URLS[selectedIndex];
  const episodesList = document.getElementById("episodesList");
  episodesList.innerHTML = "Loading...";
  for (const _ of CORS_PROXIES) {
    try {
      const response = await fetch(
        `${CORS_PROXIES[currentProxyIndex]}${selectedFeed.url}`
      );
      if (!response.ok) throw new Error("Failed to fetch RSS feed");
      const data = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(data, "text/xml");
      displayEpisodes(xmlDoc, selectedFeed.name);
      return;
    } catch (error) {
      console.error("Error fetching the RSS feed:", error);
      getNextProxy();
    }
  }

  episodesList.innerHTML = `Failed to load episodes from ${selectedFeed.name} using all available proxies.`;
}

function displayEpisodes(xmlDoc, channelTitle) {
  let items = xmlDoc.getElementsByTagName("item");
  items = Array.from(items).reverse();

  let htmlContent = `<h2>${channelTitle}</h2>`;

  for (let item of items) {
    const title = item.getElementsByTagName("title")[0]?.textContent;
    const duration =
      item.getElementsByTagName("itunes:duration")[0]?.textContent;
    const formattedDuration = formatDuration(duration);
    const enclosure = item.getElementsByTagName("enclosure")[0];
    const audioUrl = enclosure ? enclosure.getAttribute("url") : null;

    const playedClass = localStorage.getItem(audioUrl)
      ? '<span class="played">&#10004;</span>'
      : '<span class="played">&nbsp;</span>';
    if (title && audioUrl) {
      htmlContent += `
        <div>
          ${playedClass}
          ${formattedDuration ? `<span> (${formattedDuration})</span>` : ""}
          <a href="#" onclick="playEpisode('${audioUrl}', this)">${title}</a>
        </div>
      `;
    }
  }

  document.getElementById("episodesList").innerHTML =
    htmlContent || `<div>No episodes found for ${channelTitle}.</div>`;
}

function playEpisode(url, element) {
  const audioPlayer = document.getElementById("audioPlayer");
  audioPlayer.src = url;
  audioPlayer.play();
  currentEpisodeUrl = url;
}

function markAsPlayed() {
  if (currentEpisodeUrl) {
    localStorage.setItem(currentEpisodeUrl, "played");
    const links = document.querySelectorAll("#episodesList a");
    links.forEach((link) => {
      if (link.getAttribute("onclick").includes(currentEpisodeUrl)) {
        link.parentElement.firstElementChild.innerHTML =
          '<span class="played">&#10004;</span>';
      }
    });
  }
}

function formatDuration(duration) {
  if (!duration) return "";
  const parts = duration.split(":").map((part) => parseInt(part, 10));
  if (parts.length === 3) {
    return `${parts[0]}:${parts[1].toString().padStart(2, "0")}:${parts[2]
      .toString()
      .padStart(2, "0")}`;
  } else if (parts.length === 2) {
    return `${parts[0]}:${parts[1].toString().padStart(2, "0")}`;
  } else if (parts.length === 1) {
    const hours = Math.floor(parts[0] / 3600);
    const minutes = Math.floor((parts[0] % 3600) / 60);
    const seconds = parts[0] % 60;
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }
  return duration;
}
