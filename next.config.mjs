const config={
  turbopack:{root:process.cwd()},
  outputFileTracingRoot:process.cwd(),
  serverExternalPackages:['sharp','exceljs'],
  async headers(){return [{source:'/(.*)',headers:[
    {key:'X-Content-Type-Options',value:'nosniff'},
    {key:'X-Frame-Options',value:'DENY'},
    {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
    {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'}
  ]}];}
};
export default config;
