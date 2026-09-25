import type {CampusLocation,SurvivalRecommendation} from '../types/campus';
export const demoQuery = "I have 25 minutes between my classes and I'm hungry. I'm at University Hall and my next class is at Innovation Hall.";
export const locations: CampusLocation[] = [ ['university','University Hall','academic'],['gateway','Gateway','academic'],['innovation','Innovation Hall','academic'],['sel','Science and Engineering Laboratory (SEL)','academic'],['nifs','NIFS','academic'],['library','University Library','study'],['commons','Student Commons','study'],['cafe','Campus Café','food'],['coffee','Gateway Café','coffee'] ].map(([id,name,type])=>({id,name,type:type as CampusLocation['type']}));
export function makeRecommendation(query:string, place?:string):SurvivalRecommendation {
 const window=Number(query.match(/(\d+)\s*min/i)?.[1]??25);
 const direct=/class|direct/i.test(query)&& !/hungry|food|coffee|study|between/i.test(query);
 const location=place??(direct?'Innovation Hall':/coffee/i.test(query)?'Gateway Café':/study/i.test(query)?'University Library':'Campus Café');
 const times=location==='Innovation Hall'?[6,0,0]:location==='Gateway Café'?[7,8,5]:location==='Nearby Food'?[9,12,6]:location==='University Library'?[4,10,6]:[5,10,6];
 const totalMinutes=times.reduce((a,b)=>a+b,0),bufferMinutes=window-totalMinutes;
 return {location,totalMinutes,bufferMinutes,risk:bufferMinutes<0?'screwed':bufferMinutes<=3?'tight':'safe',reason:[`Fits ${bufferMinutes<0?'outside':'inside'} your ${window}-minute window`,location==='Innovation Hall'?'The direct route skips all detours':'Your stop is along a modeled campus route','Location is open in this demo',`${Math.abs(bufferMinutes)} minutes ${bufferMinutes<0?'over your time limit':'left before class'}`,'Compared walking and stop times across alternatives'],steps:[{type:'walk',label:location==='Innovation Hall'?'Walk directly to class':`Walk to ${location}`,minutes:times[0]},...(times[1]?[{type:'food' as const,label:location==='University Library'?'Settle in and study':location==='Gateway Café'?'Grab your coffee':'Grab a bite',minutes:times[1]},{type:'walk' as const,label:'Walk to Innovation Hall',minutes:times[2]}]:[])]};
}
// TODO: Replace with AI/routing backend
export async function getSurvivalRecommendation(query:string):Promise<SurvivalRecommendation>{ await new Promise(r=>setTimeout(r,1000)); return makeRecommendation(query); }
