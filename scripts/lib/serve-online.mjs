import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const types = {html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8'};

export async function serveOnline(port, roomApi) {
  const root=resolve('dist');
  const index=(await readFile(resolve(root,'index.html'),'utf8')).replace('<html lang="en">','<html lang="en" data-online-host>');
  const lobby=await readFile(resolve(root,'lan.html'),'utf8');
  const server=createServer({requestTimeout:10000,headersTimeout:8000},async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    const path=req.url.split('?')[0];
    if (path.startsWith('/lan-api/')) {
      req.url=path.slice('/lan-api'.length);
      await roomApi(req,res);
      return;
    }
    if (req.method!=='GET' && req.method!=='HEAD') {res.writeHead(405).end();return;}
    if (path==='/healthz') {res.writeHead(200,{'Content-Type':'text/plain'}).end('ok');return;}
    if (path==='/' || path==='/index.html' || path==='/lan.html') {
      res.writeHead(200,{'Content-Type':types.html,'Cache-Control':'no-cache'});
      res.end(req.method==='HEAD' ? undefined : path==='/lan.html' ? lobby : index);
      return;
    }
    if (/^\/assets\/[A-Za-z0-9_.-]+\.(js|css)$/.test(path)) {
      try {
        const file=await readFile(resolve(root,path.slice(1)));
        res.writeHead(200,{'Content-Type':types[path.split('.').at(-1)],'Cache-Control':'public, max-age=31536000, immutable'});
        res.end(req.method==='HEAD' ? undefined : file);
        return;
      } catch {}
    }
    res.writeHead(404,{'Content-Type':'text/plain'}).end('Not found');
  });
  await new Promise((done,reject)=>{server.once('error',reject);server.listen(port,'0.0.0.0',done);});
  console.log('Laser Strike 2 online server listening on port '+port);
}
