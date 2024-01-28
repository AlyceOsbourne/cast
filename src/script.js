import html from "./htmllib";
import audio from "./audio";

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

  document.querySelector("#pause").addEventListener("click", () => {
    if (paused) {
      audio.unpause();
      paused = false;
    } else {
      audio.pause();
      paused = true;
    }
  });

  document.querySelector("#volume").addEventListener("input", (ev) => {
    audio.setVolume(ev.currentTarget.value);
  });
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

    const playedClass = localStorage.getItem(audioUrl)
      ? html.span({ className: "played", textContent: "\u{10004}" })
      : html.span({ className: "played", textContent: "\xa0" });
    if (title && audioUrl) {
      const div = html.div({});
      div.replaceChildren(
        playedClass,
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
  audio.switchTrack(url).then(() => {
    audio.renderWaveform(document.querySelector("#waveform"));
  });
  paused = false;
}

function markAsPlayed() {
  if (currentEpisodeUrl) {
    localStorage.setItem(currentEpisodeUrl, "played");
    const links = document.querySelectorAll("#episodesList a");
    links.forEach((link) => {
      if (link.getAttribute("onclick").includes(currentEpisodeUrl)) {
        link.parentElement.firstElementChild.replaceChildren(
          html.span({ class: "played", textContent: "\u{10004}" })
        );
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
