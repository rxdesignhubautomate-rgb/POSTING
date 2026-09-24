import defaults from '../config/channels.json';

export function normalizeClientSettings(value={}){
  const nested=Array.isArray(value.channels)?null:value.channels?.channels?value.channels:null;
  const source=nested??value;
  return {
    ...defaults,
    ...value,
    ...source,
    brands:{...defaults.brands,...(source.brands??{})},
    personas:{...defaults.personas,...(source.personas??{})},
    channels:Array.isArray(source.channels)?source.channels:defaults.channels,
    accounts:Array.isArray(value.accounts)?value.accounts:[],
    options:Array.isArray(value.options)?value.options:[],
    workspaces:Array.isArray(value.workspaces)?value.workspaces:[]
  };
}
