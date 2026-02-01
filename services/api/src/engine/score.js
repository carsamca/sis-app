function clamp(n,min=0,max=100){ return Math.max(min, Math.min(max,n)); }
function toNum(v,d=0){ const n=Number(v); return Number.isFinite(n)?n:d; }

export function computeStarScore(input, ctx, derived={}){
  const bsr=toNum(input.bsr,0);
  let demand=50;
  if(bsr>0){
    const log=Math.log10(bsr);
    demand = clamp(100 - (log*18 + (bsr/60000)*10));
  }
  const competitors=toNum(input.competitorCount,20);
  let competition=70 - clamp((competitors-10)*2,0,45);
  if(ctx.entry_strategy==="conservative") competition-=5;
  if(ctx.capital_profile==="low") competition-=5;
  competition=clamp(competition);

  const gm=toNum(derived.grossMargin,0.30);
  let profit=clamp(gm*200);

  const diff=45; // heuristic (no scraping yet)
  const total = clamp(Math.round(demand*0.35 + competition*0.30 + profit*0.25 + diff*0.10));
  return {
    totalScore: total,
    passed: total>=70,
    components: [
      {name:"Demand",weight:35,score:Math.round(demand),explanation: bsr?`BSR=${bsr}`:"No BSR"},
      {name:"Competition",weight:30,score:Math.round(competition),explanation:`offerCount=${competitors}`},
      {name:"Profitability",weight:25,score:Math.round(profit),explanation:`grossMargin=${(gm*100).toFixed(1)}%`},
      {name:"Differentiation",weight:10,score:diff,explanation:"Heuristic default"}
    ],
    explanation: `Score ${total}/100 ${total>=70?"meets":"does not meet"} threshold 70.`
  };
}