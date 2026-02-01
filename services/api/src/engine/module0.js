function titleCase(s){ return (s||"").toString().toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()); }

const POOLS={
  kitchen:["Silicone Sink Splash Guard","Adjustable Drawer Dividers","Spice Jar Labels Kit","Foldable Dish Drying Mat"],
  default:["Stackable Storage Bins","Travel Packing Cubes","Reusable Lint Roller","Magnetic Fridge Planner Board"]
};

function pickPool(category){
  const c=(category||"").toLowerCase();
  if(c.includes("kitchen")) return POOLS.kitchen;
  return POOLS.default;
}

export function runDiscovery({marketplace,category,count,language}){
  const pool=pickPool(category);
  const out=[];
  for(let i=0;i<count;i++){
    const p=pool[i%pool.length];
    out.push({
      product: language==="ES" ? titleCase(p) : p,
      category: titleCase(category),
      priceRange: marketplace==="UK" ? "£25–£60" : "$25–$60",
      signal: "repeated",
      note: language==="ES" ? "Varias marcas pequeñas ofrecen soluciones similares." : "Multiple small brands offer similar solutions."
    });
  }
  return { candidates: out, total: out.length, marketplace, category: titleCase(category) };
}