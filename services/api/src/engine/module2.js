import { asinFromUrl, fetchKeepaProduct, extractSignalsFromKeepa } from "./keepa.js";
import { evalDR1_IP, evalDR2_Restricted, evalDR3_BrandDominance, evalDR4_Margin, evalDR5_Logistics } from "./rules.js";
import { computeStarScore } from "./score.js";

function pack(rule,res){ return {rule, passed:res.passed, reason:res.reason||null, extra:res.extra||null}; }
function nowISO(){ return new Date().toISOString(); }

export async function runDecision(request){
  const ctx = {
    marketplace: request.marketplace,
    capital_profile: request.capital_profile,
    product_phase: request.product_phase,
    entry_strategy: request.entry_strategy,
    language: request.language
  };

  const asin = asinFromUrl(request.url);
  if(!asin){
    return { discard_rules_results:[], star_score:null, verdict:"DISCARDED", keyword_intelligence:null,
      summary: ctx.language==="ES" ? "DESCARTADO: URL inválida (ASIN no encontrado)." : "DISCARDED: Invalid URL (ASIN not found).",
      request_info:{...ctx,url:request.url,timestamp:nowISO()}
    };
  }

  const product = await fetchKeepaProduct({ marketplace: ctx.marketplace, asin });
  const extracted = extractSignalsFromKeepa(product);
  const input = { ...extracted, url: request.url, asin };

  const dr=[];
  const r1=evalDR1_IP(input,ctx); dr.push(pack("DR-1: Patents / IP risk",r1)); if(!r1.passed) return discard(ctx,request,dr);
  const r2=evalDR2_Restricted(input,ctx); dr.push(pack("DR-2: Restricted or sensitive category",r2)); if(!r2.passed) return discard(ctx,request,dr);
  const r3=evalDR3_BrandDominance(input,ctx); dr.push(pack("DR-3: Brand dominance or review moat",r3)); if(!r3.passed) return discard(ctx,request,dr);
  const r4=evalDR4_Margin(input,ctx); dr.push(pack("DR-4: Gross margin viability",r4)); if(!r4.passed) return discard(ctx,request,dr);
  const r5=evalDR5_Logistics(input,ctx); dr.push(pack("DR-5: Logistics risk",r5)); if(!r5.passed) return discard(ctx,request,dr);

  const star = computeStarScore(input, ctx, r4.extra||{});
  let verdict="DISCARDED";
  if(star.totalScore>=70) verdict="APPROVED";
  else if(star.totalScore>=60) verdict="BORDERLINE";

  return {
    discard_rules_results: dr,
    star_score: star,
    verdict,
    keyword_intelligence: null,
    summary: `${verdict}: Star Score ${star.totalScore}/100.`,
    extracted_signals: extracted,
    request_info:{...ctx,url:request.url,asin,timestamp:nowISO()}
  };
}

function discard(ctx,request,dr){
  const failed=dr.find(x=>!x.passed);
  const summary = ctx.language==="ES" ? `DESCARTADO: Falló ${failed.rule}` : `DISCARDED: Failed ${failed.rule}`;
  return { discard_rules_results:dr, star_score:null, verdict:"DISCARDED", keyword_intelligence:null, summary,
    request_info:{...ctx,url:request.url,timestamp:nowISO()}
  };
}