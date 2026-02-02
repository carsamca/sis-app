// apps/web/src/api.js
export class SISAPI {
  constructor(baseUrl = (typeof window !== "undefined" ? window.location.origin : "")) {
    this.baseUrl = (baseUrl || "").replace(/\/$/, "");
  }

  async _get(path) {
    const res = await fetch(`${this.baseUrl}${path}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async _post(path, payload) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = data?.errors ? data.errors.join(" | ") : (data?.error || `HTTP ${res.status}`);
      throw new Error(msg);
    }
    return data;
  }

  health() {
    return this._get("/api/health");
  }

  discovery(payload) {
    return this._post("/api/discovery", payload);
  }

  decision(payload) {
    return this._post("/api/decision", payload);
  }
}

