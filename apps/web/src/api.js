export class SISAPI {
  constructor(baseUrl="http://localhost:3001"){ this.baseUrl=baseUrl.replace(/\/$/,""); }
  async discovery(payload){ return this._post("/api/discovery",payload); }
  async decision(payload){ return this._post("/api/decision",payload); }
  async _post(path,payload){
    const res=await fetch(`${this.baseUrl}${path}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    const data=await res.json().catch(()=>({}));
    if(!res.ok) throw new Error((data.errors&&data.errors.join(" | "))||data.error||`HTTP ${res.status}`);
    return data;
  }
}