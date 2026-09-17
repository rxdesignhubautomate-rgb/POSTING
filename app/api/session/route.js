import { NextResponse } from 'next/server';
import { isDemo,validSession,cookieName,checkPassword,signSession,sameOrigin,errorResponse } from '../../../lib/auth';
import { rateLimit } from '../../../lib/db';
export const runtime='nodejs';
export async function GET(req){return Response.json({demo:isDemo(),authenticated:!isDemo()&&validSession(req.cookies.get(cookieName)?.value)},{headers:{'Cache-Control':'no-store'}});}
export async function POST(req){try{
  sameOrigin(req);if(isDemo())throw new Error('Configure ADMIN_PASSWORD and SESSION_SECRET in Vercel first.');
  const ip=req.headers.get('x-vercel-forwarded-for')??req.headers.get('x-forwarded-for')??'local';
  await rateLimit('login:'+ip,10,900);await rateLimit('login-global',100,900);
  const {password}=await req.json();if(!checkPassword(password))return Response.json({error:'Incorrect password.'},{status:401});
  const response=NextResponse.json({ok:true});response.cookies.set(cookieName,signSession(),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:12*3600});return response;
}catch(e){return errorResponse(e);}}
export async function DELETE(req){try{sameOrigin(req);const r=NextResponse.json({ok:true});r.cookies.set(cookieName,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:0});return r;}catch(e){return errorResponse(e);}}
