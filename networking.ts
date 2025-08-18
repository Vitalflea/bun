const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0";

export async function get(url: string, headers: Record<string, string> = {}): Promise<Response> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": USER_AGENT,
      ...headers,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  return response;
}

export async function fetchJson(url: string, headers: Record<string, string> = {}): Promise<any> {
  const response = await get(url, {
    "Content-Type": "application/json",
    "Accept": "application/json",
    ...headers,
  });

    const textResponse = await response.text();
    return textResponse;
}
