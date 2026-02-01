// apps/web/src/api.js

export class SISApi {
  constructor(baseUrl = window.location.origin) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async request(path, payload) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    let data = {};
    try {
      data = await res.json();
    } catch (e) {}

    if (!res.ok) {
      const msg = data?.errors
        ? data.errors.join(" | ")
        : `HTTP ${res.status}`;
      throw new Error(msg);
    }

    return data;
  }

  discovery(payload) {
    return this.request("/api/discovery", payload);
  }

  decision(payload) {
    return this.request("/api/decision", payload);
  }
}

export const api = new SISApi();
