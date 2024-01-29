import html from "./htmllib";
import createAudio from "./audio";

const audio = createAudio(
  Number.parseFloat(localStorage.getItem("volume") ?? "1.0")
);

let currentEpisodeUrl = "";

const CORS_PROXIES = [
  "https://jwt.mousetail.nl/proxy/cors?url=",
  // "https://api.allorigins.win/raw?url=",
  // "https://cors.bridged.cc/",
  // "https://cors-anywhere.herokuapp.com/",
];
let currentProxyIndex = 0;
let paused = true;

const defaultFeeds = [
  {
    name: "Lateral with Tom Scott",
    url: "https://feeds.megaphone.fm/lateralcast",
  },
  { name: "RadioLab", url: "https://feeds.simplecast.com/EmVW7VGp" },
  { name: "RealPython", url: "https://realpython.com/podcasts/rpp/feed/" },
  {
    name: "Podcast of unnecessary detail",
    url: "https://feeds.acast.com/public/shows/61deed94f2acc80013aab8aa",
  },
  {
    name: "Lets learn everything",
    url: "https://feeds.simplecast.com/2pvdZXa_",
  },
];
let RSS_FEED_URLS =
  JSON.parse(localStorage.getItem("userFeeds")) || defaultFeeds;

document.addEventListener("DOMContentLoaded", () => {
  populateFeedSelector();
  document
    .getElementById("feedSelector")
    .addEventListener("change", fetchSelectedFeed);
  fetchSelectedFeed();

  document
    .getElementById("deleteCurrentFeedButton")
    .addEventListener("click", removeCurrentFeed);

  const pauseButton = document.querySelector("#pause");
  pauseButton.addEventListener("click", () => {
    if (paused) {
      audio.unpause();
      pauseButton.firstElementChild.textContent = "⏵";
      paused = false;
    } else {
      audio.pause();
      pauseButton.firstElementChild.textContent = "⏸";
      paused = true;
    }
  });

  const volumeWidget = document.querySelector("#volume");

  volumeWidget.value = audio.getVolume();
  volumeWidget.addEventListener("input", (ev) => {
    audio.setVolume(ev.currentTarget.value);
  });
  volumeWidget.addEventListener("change", (ev) => {
    localStorage.setItem("volume", ev.target.value);
  });

  const timestampWidget = document.querySelector("#timestamp");

  audio.addEventListener("timestampChange", ({ offset, duration }) => {
    document.querySelector("#progress").style.width = `${
      (offset * 100) / duration
    }%`;
    timestampWidget.textContent = formatNumericalDuration(offset);
  });

  document.querySelector("#waveform").addEventListener("click", (ev) => {
    audio.playFromTimestamp(ev.offsetX / ev.target.width);
  });

  document.querySelector("#addFeedButton").addEventListener("click", addFeed);

  audio.addEventListener("ended", markAsPlayed);
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
      document.getElementById("episodesList").textContent =
        "No feeds available. Please add a new feed.";
    }
  }

  populateFeedSelector();
  fetchSelectedFeed();
}

function populateFeedSelector() {
  const feedSelector = document.getElementById("feedSelector");
  feedSelector.replaceChildren(); // Clear existing options
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
  episodesList.textContent = "Loading...";
  for (const _ of CORS_PROXIES) {
    try {
      const response = await fetch(
        `${CORS_PROXIES[currentProxyIndex]}${encodeURIComponent(
          selectedFeed.url
        )}`,
        {
          mode: "cors",
          cache: "force-cache",
        }
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

  episodesList.textContent = `Failed to load episodes from ${selectedFeed.name} using all available proxies.`;
}

function displayEpisodes(xmlDoc, channelTitle) {
  let items = xmlDoc.getElementsByTagName("item");
  items = Array.from(items).reverse();

  let htmlContent = [html.h2({ textContent: channelTitle })];

  for (let item of items) {
    const title = item.getElementsByTagName("title")[0]?.textContent;
    const duration =
      item.getElementsByTagName("itunes:duration")[0]?.textContent;
    const formattedDuration = formatDuration(duration);
    const enclosure = item.getElementsByTagName("enclosure")[0];
    const audioUrl = enclosure ? enclosure.getAttribute("url") : null;

    const played = localStorage.getItem(audioUrl);
    const playedIcon = played
      ? html.span({ className: "playedIcon", textContent: "✔" })
      : html.span({ className: "playedIcon", textContent: "\xa0" });
    if (title && audioUrl) {
      const div = html.div({
        className: played ? "played" : "",
        dataset: {
          url: audioUrl,
        },
      });
      div.replaceChildren(
        playedIcon,
        formattedDuration ? html.span({ textContent: formattedDuration }) : "",
        html.a({
          href: "#",
          onclick: () => playEpisode(audioUrl),
          textContent: title,
        })
      );
      htmlContent.push(div);
    }
  }

  document.getElementById("episodesList").replaceChildren(
    ...(htmlContent.length > 0
      ? htmlContent
      : div({
          textContent: `<div>No episodes found for ${channelTitle}.</div>`,
        }))
  );
}

function playEpisode(url) {
  document.querySelector("#loading").style.display = "block";
  const canvas = document.querySelector("#waveform");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  audio
    .switchTrack(url)
    .then((duration) => {
      audio.renderWaveform(document.querySelector("#waveform"));
      document.querySelector("#duration").textContent =
        formatNumericalDuration(duration);

      currentEpisodeUrl = url;
      paused = false;

      audio.unpause();

      let oneSecondPlayed = false;
      const onTimeUpdate = ({ offset }) => {
        if (offset >= 1 && !oneSecondPlayed) {
          document.querySelector("#loading").style.display = "none";
          oneSecondPlayed = true;
          audio.removeEventListener("timestampChange", onTimeUpdate);
        }
      };

      audio.addEventListener("timestampChange", onTimeUpdate);
    })
    .catch((error) => {
      console.error("Error switching the audio track:", error);
      document.querySelector("#loading").style.display = "none";
    });
}

function markAsPlayed() {
  if (currentEpisodeUrl) {
    localStorage.setItem(currentEpisodeUrl, "played");
    const selector = `div[data-url="${CSS.escape(currentEpisodeUrl)}"]`;
    const link = document.querySelector(selector);
    link.classList.add("played");
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
    return formatNumericalDuration(parts[0]);
  }
  return duration;
}

function formatNumericalDuration(duration) {
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  const seconds = Math.floor(duration % 60);
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  } else {
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }
}
