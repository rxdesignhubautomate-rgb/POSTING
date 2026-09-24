export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
  return Response.json({ok:true,service:'rx-studio',version:'future-press-v2',time:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});
}
