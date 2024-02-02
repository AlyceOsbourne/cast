const hostsThatRequireCors = JSON.parse(
  localStorage.getItem("corsHosts") ?? "[]"
);

const CORS_PROXIES = [
  "https://jwt.mousetail.nl/proxy/cors?url=",
  // "https://api.allorigins.win/raw?url=",
  // "https://cors.bridged.cc/",
  // "https://cors-anywhere.herokuapp.com/",
];
let currentProxyIndex = 0;

function getNextProxy() {
  currentProxyIndex = (currentProxyIndex + 1) % CORS_PROXIES.length;
  return CORS_PROXIES[currentProxyIndex];
}

async function corsFetch(url_path, options = {}) {
  const url = new URL(url_path, window.location.href);
  const origin = url.origin;

  if (hostsThatRequireCors.some((j) => j == origin)) {
    return fetchWithCors(url, options);
  } else {
    try {
      return await fetch(url.toString(), options);
    } catch {
      hostsThatRequireCors.push(origin);
      localStorage.setItem("corsHosts", JSON.stringify(hostsThatRequireCors));
      return fetchWithCors(url, options);
    }
  }
}

async function fetchWithCors(url, options) {
  for (const _ of CORS_PROXIES) {
    try {
      const response = await fetch(
        `${CORS_PROXIES[currentProxyIndex]}${encodeURIComponent(
          url
        ).toString()}`,
        {
          ...options,
          mode: "cors",
        }
      );
      if (!response.ok) throw new Error("Failed to fetch RSS feed");
      return response;
    } catch (error) {
      console.error("Error fetching the RSS feed:", error);
      getNextProxy();
    }
  }
}

export default corsFetch;
