import html from "./htmllib";
import createAudio from "./audio";
import corsFetch from "./cors";
import DOMPurify from "dompurify";

const audio = createAudio(
  Number.parseFloat(localStorage.getItem("volume") ?? "1.0")
);

let currentEpisodeUrl = "";

let paused = true;
const xlinkNamespace = "http://www.w3.org/1999/xlink";

const episodeQueue = {
  explicit: [],
  implicit: [],
};

const defaultFeeds = [
  {
    name: "Lateral with Tom Scott",
    url: "https://feeds.megaphone.fm/lateralcast",
  },
  { name: "RadioLab", url: "https://feeds.simplecast.com/EmVW7VGp" },
  { name: "RealPython", url: "https://realpython.com/podcasts/rpp/feed" },
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

  const pauseButton = document.querySelector("#pauseButton");
  pauseButton.addEventListener("click", () => {
    if (paused) {
      audio.unpause();
      paused = false;
    } else {
      audio.pause();
      paused = true;
    }

    updatePauseButtonIcon();
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
  document
    .querySelector("#backToStartButton")
    .addEventListener("click", () => audio.playFromTimestamp(0));
  document
    .querySelector("#nextTrackButton")
    .addEventListener("click", nextTrack);

  audio.addEventListener("ended", markAsPlayed);
  audio.addEventListener("ended", nextTrack);
});

function updatePauseButtonIcon() {
  const use = pauseButton.firstElementChild.firstElementChild;
  use.setAttributeNS(
    xlinkNamespace,
    "href",
    paused
      ? new URL("./icons/play.svg", import.meta.url) + "#play"
      : new URL("./icons/pause.svg", import.meta.url) + "#pause"
  );
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
  try {
    const response = await corsFetch(selectedFeed.url, {
      cache: "force-cache",
    });

    const data = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(data, "text/xml");
    displayEpisodes(xmlDoc, selectedFeed.name);
  } catch (ex) {
    console.error(ex);
    episodesList.textContent = `Failed to load episodes from ${selectedFeed.name} using all available proxies.`;
  }
}

function displayEpisodes(xmlDoc, channelTitle) {
  let items = xmlDoc.getElementsByTagName("item");
  items = Array.from(items).map((item) => {
    const enclosure = item.getElementsByTagName("enclosure")[0];
    return {
      title: item.getElementsByTagName("title")[0]?.textContent,
      duration: item.getElementsByTagName("itunes:duration")[0]?.textContent,
      notes: DOMPurify.sanitize(
        item.getElementsByTagName("content:encoded")[0]?.textContent
      ),
      audioUrl: enclosure ? enclosure.getAttribute("url") : null,
    };
  });

  let htmlContent = [html.h2({ textContent: channelTitle })];

  items.forEach(({ title, duration, audioUrl, notes }, index) => {
    const formattedDuration = formatDuration(duration);

    const played = localStorage.getItem(audioUrl);
    const playedIcon = html.span({
      className: "playedIcon",
    });
    if (title && audioUrl) {
      const div = html.div({
        className: played ? "played" : "",
        dataset: {
          url: audioUrl,
        },
      });
      div.replaceChildren(
        playedIcon,
        html.span({ textContent: formattedDuration }),
        html.a({
          href: "#",
          onclick: () => {
            episodeQueue.implicit = items.slice(0, index).reverse();
            playEpisode(audioUrl, notes);
          },
          textContent: title,
        })
      );
      htmlContent.push(div);
    }
  });

  document.getElementById("episodesList").replaceChildren(
    ...(htmlContent.length > 0
      ? htmlContent
      : div({
          textContent: `<div>No episodes found for ${channelTitle}.</div>`,
        }))
  );
}

function playEpisode(url, notes) {
  document.querySelector(".show-notes-column").innerHTML = notes;
  document.querySelector("#loading").style.display = "block";
  const canvas = document.querySelector("#waveform");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  audio.pause();
  audio
    .switchTrack(url)
    .then((duration) => {
      audio.renderWaveform(document.querySelector("#waveform"));
      document.querySelector("#duration").textContent =
        formatNumericalDuration(duration);

      currentEpisodeUrl = url;
      paused = false;
      audio.unpause();

      updatePauseButtonIcon();

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
  if (!duration) return "--:--";
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

function popNextEpisodeUrl() {
  if (episodeQueue.explicit.length > 0) {
    return { type: "explicit", url: episodeQueue.explicit.shift() };
  } else {
    return { type: "implicit", url: episodeQueue.implicit.shift(0) };
  }
}

function nextTrack() {
  const autoPlay = document.querySelector("#autoPlayInput").checked;

  const nextEpisode = popNextEpisodeUrl();

  if (nextEpisode.type === "implicit" && !autoPlay) {
    return;
  }

  if (nextEpisode.url === null) {
    return;
  }

  playEpisode(...nextEpisode.url);
}
