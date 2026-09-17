import { authorize,errorResponse } from '../../../lib/auth';
import { settings,saveSettings,getSetting,saveSetting,databaseUrl } from '../../../lib/db';
import { publer } from '../../../lib/publer';
import { defaultChannels,normalizeChannels,validateChannelMappings } from '../../../lib/channels';
export const runtime='nodejs';export const maxDuration=120;
export async function GET(req){try{authorize(req);return Response.json({...await settings(),channels:normalizeChannels(await getSetting('channels',defaultChannels())),configured:{database:Boolean(databaseUrl()),blob:Boolean(process.env.BLOB_READ_WRITE_TOKEN&&process.env.BLOB_PUBLIC_ORIGIN),publer:Boolean(process.env.PUBLER_API_KEY),workspace:Boolean(process.env.PUBLER_WORKSPACE_ID),openai:Boolean(process.env.OPENAI_API_KEY)},workspace_id:process.env.PUBLER_WORKSPACE_ID??''});}catch(e){return errorResponse(e);}}
export async function POST(req){try{
  authorize(req,{write:true});let body={};try{body=await req.json();}catch{}
  if(body.action==='save_channels'){const value=normalizeChannels(body.channels);const errors=validateChannelMappings(value);if(errors.length)throw new Error(errors.join('; '));await saveSetting('channels',value);return Response.json({channels:value,message:'Channel personas saved.'});}
  const ws=await publer('GET','/workspaces');const workspaces=Array.isArray(ws)?ws:ws.workspaces;
  if(!process.env.PUBLER_WORKSPACE_ID){const value={workspaces,accounts:[],options:[]};await saveSettings(value);return Response.json({...value,message:'Set PUBLER_WORKSPACE_ID to one of the listed IDs in Vercel, redeploy, then sync again.'});}
  if(!workspaces?.some(w=>w.id===process.env.PUBLER_WORKSPACE_ID))throw new Error('Configured workspace is not accessible.');
  const a=await publer('GET','/accounts'),accounts=Array.isArray(a)?a:a.accounts;if(!Array.isArray(accounts))throw new Error('Unexpected accounts response.');
  const options=accounts.length?await publer('GET',`/workspaces/${encodeURIComponent(process.env.PUBLER_WORKSPACE_ID)}/media_options?accounts=${encodeURIComponent(accounts.map(a=>a.id).join(','))}`):[];
  const value={workspaces,accounts,options,synced_at:new Date().toISOString(),workspace_id:process.env.PUBLER_WORKSPACE_ID};await saveSettings(value);return Response.json(value);
}catch(e){return errorResponse(e);}}
