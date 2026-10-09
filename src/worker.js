import {catalog,barNames,operationDate} from './catalog.js';
import {token,digest,equal,passwordHash,verifyPassword,validQuantity,validDate,canAccessBar} from './security.js';
class HttpError extends Error{constructor(status,message){super(message);this.status=status}}
const fail=(status,message)=>{throw new HttpError(status,message)};
const json=(body,status=200,headers={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...headers}});
const publicUser=u=>({id:u.id,username:u.username,name:u.name,role:u.role,bar:u.bar,active:u.active});
const stmt=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
const rows=async(env,sql,...args)=>(await stmt(env,sql,...args).all()).results;
const one=(env,sql,...args)=>stmt(env,sql,...args).first();
const audit=(env,u,action,record)=>stmt(env,'INSERT INTO audit(id,actor,action,record,at) VALUES(?,?,?,?,?)',crypto.randomUUID(),u.id,action,String(record),new Date().toISOString());
function admin(u){if(u.role!=='admin')fail(403,'Acesso exclusivo do administrador.')}
function barAccess(u,bar){if(!Number.isInteger(bar)||bar<1||bar>6||!canAccessBar(u,bar))fail(403,'Você não tem acesso a esta barra.')}
function sessionToken(request){return request.headers.get('Cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith('jl_session='))?.slice(11)||''}
async function identity(request,env){const value=sessionToken(request);if(!/^[a-f0-9]{64}$/.test(value))return null;return one(env,'SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.hash=? AND s.expires>? AND u.active=1',await digest(value),Date.now())}
function cookie(request,value,maxAge){return `jl_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${new URL(request.url).protocol==='https:'?'; Secure':''}`}
async function initialize(env,username,password){
 if(!env.INITIAL_ADMIN_USER||!env.INITIAL_ADMIN_PASSWORD||!env.AUTH_PEPPER)fail(503,'Configure as credenciais do administrador no Cloudflare.');
 if(!equal(await digest(username),await digest(env.INITIAL_ADMIN_USER.toLowerCase()))||!equal(await digest(password),await digest(env.INITIAL_ADMIN_PASSWORD)))return;
 const hash=await passwordHash(password,env.AUTH_PEPPER);
 await env.DB.batch([stmt(env,"INSERT INTO users(id,username,name,password_hash,role,bar) SELECT 'owner',?,?,?,'admin',NULL WHERE NOT EXISTS(SELECT 1 FROM users)",username,'Administrador',hash),...barNames.map((name,i)=>stmt(env,'INSERT OR IGNORE INTO bars(id,name) VALUES(?,?)',i+1,name)),...catalog.map(p=>stmt(env,'INSERT OR IGNORE INTO products(id,name,category,position) VALUES(?,?,?,?)',p.id,p.name,p.category,p.position))]);
}
async function login(request,env,data){
 const username=String(data.username||'').trim().toLowerCase(),password=String(data.password||'');
 if(!/^[a-z0-9._-]{3,40}$/.test(username)||password.length>200)fail(401,'Usuário ou senha incorretos.');
 if(!env.AUTH_PEPPER)fail(503,'A configuração de acesso ainda não foi concluída.');
 const key=await digest('login:'+ (request.headers.get('CF-Connecting-IP')||'local'));
 const now=Date.now();
 await stmt(env,'INSERT INTO attempts(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN attempts.expires<? THEN 1 ELSE attempts.count+1 END,expires=CASE WHEN attempts.expires<? THEN excluded.expires ELSE attempts.expires END',key,now+900000,now,now).run();
 const attempt=await one(env,'SELECT count FROM attempts WHERE key=?',key);
 if(attempt.count>20)fail(429,'Muitas tentativas. Aguarde 15 minutos antes de tentar novamente.');
 if(!await one(env,'SELECT id FROM users LIMIT 1'))await initialize(env,username,password);
 const user=await one(env,'SELECT * FROM users WHERE username=? COLLATE NOCASE',username);
 const dummy='pbkdf2-sha256$100000$00000000000000000000000000000000$'+'0'.repeat(64);
 const valid=await verifyPassword(password,user?.password_hash||dummy,env.AUTH_PEPPER);
 if(!valid||!user?.active)fail(401,'Usuário ou senha incorretos.');
 const value=token();
 await env.DB.batch([stmt(env,'INSERT INTO sessions(hash,user_id,expires) VALUES(?,?,?)',await digest(value),user.id,now+129600000),stmt(env,'DELETE FROM sessions WHERE expires<?',now),stmt(env,'DELETE FROM attempts WHERE expires<?',now)]);
 return json({user:publicUser(user)},200,{'Set-Cookie':cookie(request,value,129600)});
}
async function getClose(env,u,id){const c=await one(env,'SELECT c.*,b.name AS bar_name FROM closes c JOIN bars b ON b.id=c.bar WHERE c.id=?',id);if(!c)fail(404,'Fechamento não encontrado.');barAccess(u,c.bar);return c}
async function closeData(env,u,id){const c=await getClose(env,u,id);const entries=await rows(env,'SELECT product,quantity,updated_at FROM entries WHERE close_id=?',id);return {...c,products:JSON.parse(c.snapshot),entries,snapshot:undefined}}
async function editable(env,u,id){const c=await getClose(env,u,id);const shift=await one(env,'SELECT status FROM shifts WHERE date=?',c.date);if(c.status!=='draft'||shift?.status!=='open')fail(409,'Este fechamento está bloqueado. Peça ao administrador para reabrir.');return c}
async function api(request,env){
 if(!env.DB)fail(503,'Banco de estoque indisponível.');
 const url=new URL(request.url);
 if(request.method==='POST'&&request.headers.get('Origin')!==url.origin)fail(403,'Origem inválida. Recarregue a página.');
 let data={};
 if(request.method==='POST'){if(!request.headers.get('Content-Type')?.includes('application/json'))fail(415,'Formato inválido.');const raw=await request.text();if(raw.length>16000)fail(413,'Dados muito grandes.');try{data=JSON.parse(raw)}catch{fail(400,'Dados inválidos.')}if(!data||typeof data!=='object'||Array.isArray(data))fail(400,'Dados inválidos.')}
 const action=request.method==='GET'?url.searchParams.get('action'):data.action;
 if(request.method==='POST'&&action==='login')return login(request,env,data);
 const u=await identity(request,env);
 if(request.method==='GET'&&action==='me')return json({user:u?publicUser(u):null});
 if(!u)fail(401,'Entre novamente para continuar.');
 if(request.method==='GET'){
  if(action==='state'){
   const bars=u.role==='admin'?await rows(env,'SELECT * FROM bars ORDER BY id'):await rows(env,'SELECT * FROM bars WHERE id=?',u.bar);
   const shifts=await rows(env,'SELECT * FROM shifts ORDER BY date DESC LIMIT 60');
   const closes=u.role==='admin'?await rows(env,'SELECT c.id,c.date,c.bar,c.status,c.submitted_at,c.notes,COUNT(e.product) AS confirmed,json_array_length(c.snapshot) AS total FROM closes c LEFT JOIN entries e ON e.close_id=c.id GROUP BY c.id ORDER BY c.date DESC LIMIT 360'):await rows(env,'SELECT c.id,c.date,c.bar,c.status,c.submitted_at,c.notes,COUNT(e.product) AS confirmed,json_array_length(c.snapshot) AS total FROM closes c LEFT JOIN entries e ON e.close_id=c.id WHERE c.bar=? GROUP BY c.id ORDER BY c.date DESC LIMIT 60',u.bar);
   return json({user:publicUser(u),bars,shifts,closes,date:operationDate(),products:u.role==='admin'?await rows(env,'SELECT * FROM products ORDER BY position'):undefined,users:u.role==='admin'?await rows(env,'SELECT id,username,name,role,bar,active FROM users ORDER BY name'):undefined});
  }
  if(action==='close')return json(await closeData(env,u,url.searchParams.get('id')));
  if(action==='audit'){admin(u);return json(await rows(env,'SELECT a.*,u.name FROM audit a LEFT JOIN users u ON u.id=a.actor ORDER BY at DESC LIMIT 100'))}
  if(action==='report'){admin(u);const date=url.searchParams.get('date');if(!validDate(date))fail(400,'Data inválida.');const all=await rows(env,'SELECT id FROM closes WHERE date=?',date);return json(await Promise.all(all.map(c=>closeData(env,u,c.id))))}
  fail(404,'Página não encontrada.');
 }
 if(request.method!=='POST')fail(405,'Método não permitido.');
 if(action==='logout'){await stmt(env,'DELETE FROM sessions WHERE hash=?',await digest(sessionToken(request))).run();return json({ok:true},200,{'Set-Cookie':cookie(request,'',0)})}
 if(action==='shift'){
  admin(u);if(!validDate(data.date))fail(400,'Informe uma data válida.');
  await env.DB.batch([stmt(env,"INSERT OR IGNORE INTO shifts(date,status,created_by) VALUES(?,'open',?)",data.date,u.id),audit(env,u,'open_shift',data.date)]);return json({ok:true});
 }
 if(action==='close_shift'){
  admin(u);if(!validDate(data.date))fail(400,'Data inválida.');
  const result=await stmt(env,"UPDATE shifts SET status='closed' WHERE date=? AND status='open' AND (SELECT COUNT(*) FROM closes WHERE date=? AND status='submitted')=6",data.date,data.date).run();
  if(!result.meta.changes)fail(409,'As seis barras precisam enviar o fechamento antes de encerrar a noite.');
  await audit(env,u,'close_shift',data.date).run();return json({ok:true});
 }
 if(action==='start'){
  barAccess(u,data.bar);if(!validDate(data.date))fail(400,'Data inválida.');
  const shift=await one(env,'SELECT status FROM shifts WHERE date=?',data.date);if(shift?.status!=='open')fail(409,'O administrador precisa abrir esta noite.');
  const items=await rows(env,'SELECT id,name,category,position FROM products WHERE active=1 ORDER BY position');if(!items.length)fail(409,'Nenhum produto habilitado.');
  const id=crypto.randomUUID();
  await stmt(env,"INSERT OR IGNORE INTO closes(id,date,bar,status,snapshot,actor) SELECT ?,?,?,'draft',?,? WHERE EXISTS(SELECT 1 FROM shifts WHERE date=? AND status='open')",id,data.date,data.bar,JSON.stringify(items),u.id,data.date).run();
  const c=await one(env,'SELECT id FROM closes WHERE date=? AND bar=?',data.date,data.bar);if(!c)fail(409,'A noite foi encerrada.');return json(await closeData(env,u,c.id));
 }
 if(action==='quantity'){
  const c=await editable(env,u,data.id);if(!validQuantity(data.quantity))fail(400,'Use uma quantidade de 0 a 1.000.000, com até 3 casas decimais.');
  if(!JSON.parse(c.snapshot).some(p=>p.id===data.product))fail(400,'Produto inválido.');
  const result=await stmt(env,"INSERT INTO entries(close_id,product,quantity,updated_by,updated_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM closes c JOIN shifts s ON s.date=c.date WHERE c.id=? AND c.status='draft' AND s.status='open') ON CONFLICT(close_id,product) DO UPDATE SET quantity=excluded.quantity,updated_by=excluded.updated_by,updated_at=excluded.updated_at",c.id,data.product,data.quantity,u.id,new Date().toISOString(),c.id).run();
  if(!result.meta.changes)fail(409,'O fechamento foi bloqueado.');
  await audit(env,u,'quantity',JSON.stringify({close:c.id,product:data.product,quantity:data.quantity})).run();return json({ok:true});
 }
 if(action==='notes'){
  const c=await editable(env,u,data.id);if(typeof data.notes!=='string'||data.notes.length>2000)fail(400,'Observações: máximo 2.000 caracteres.');
  const result=await stmt(env,"UPDATE closes SET notes=?,actor=? WHERE id=? AND status='draft' AND EXISTS(SELECT 1 FROM shifts WHERE date=closes.date AND status='open')",data.notes,u.id,c.id).run();if(!result.meta.changes)fail(409,'O fechamento foi bloqueado.');return json({ok:true});
 }
 if(action==='submit'){
  const c=await editable(env,u,data.id);
  const result=await stmt(env,"UPDATE closes SET status='submitted',submitted_at=?,actor=? WHERE id=? AND status='draft' AND EXISTS(SELECT 1 FROM shifts WHERE date=closes.date AND status='open') AND (SELECT COUNT(*) FROM entries WHERE close_id=closes.id)=json_array_length(snapshot)",new Date().toISOString(),u.id,c.id).run();
  if(!result.meta.changes)fail(409,'Confirme todos os produtos antes de enviar o fechamento.');
  await audit(env,u,'submit',c.id).run();return json({ok:true});
 }
 if(action==='reopen'){
  admin(u);const c=await getClose(env,u,data.id);
  await env.DB.batch([stmt(env,"UPDATE shifts SET status='open' WHERE date=?",c.date),stmt(env,"UPDATE closes SET status='draft',submitted_at=NULL WHERE id=?",c.id),audit(env,u,'reopen',c.id)]);return json({ok:true});
 }
 if(action==='user'){
  admin(u);const username=String(data.username||'').trim().toLowerCase(),name=String(data.name||'').trim(),bar=data.role==='admin'?null:Number(data.bar);
  if(!/^[a-z0-9._-]{3,40}$/.test(username)||!name||name.length>80||!['admin','bar'].includes(data.role)||(data.role==='bar'&&(!Number.isInteger(bar)||bar<1||bar>6)))fail(400,'Revise nome, usuário, perfil e barra.');
  if(data.id==='owner'&&(data.role!=='admin'||data.active===false))fail(400,'O administrador principal deve permanecer ativo.');
  const existing=data.id?await one(env,'SELECT * FROM users WHERE id=?',data.id):null;if(data.id&&!existing)fail(404,'Usuário não encontrado.');
  let hash=existing?.password_hash;
  if(data.password){if(typeof data.password!=='string'||data.password.length<10||data.password.length>200)fail(400,'A senha deve ter entre 10 e 200 caracteres.');hash=await passwordHash(data.password,env.AUTH_PEPPER)}
  if(!hash)fail(400,'Defina uma senha de pelo menos 10 caracteres.');
  const duplicate=await one(env,'SELECT id FROM users WHERE username=? COLLATE NOCASE AND id<>?',username,data.id||'');if(duplicate)fail(409,'Este usuário já existe.');
  const id=existing?.id||crypto.randomUUID(),active=data.active===false?0:1;
  await env.DB.batch([stmt(env,'INSERT INTO users(id,username,name,password_hash,role,bar,active) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET username=excluded.username,name=excluded.name,password_hash=excluded.password_hash,role=excluded.role,bar=excluded.bar,active=excluded.active',id,username,name,hash,data.role,bar,active),...(existing?[stmt(env,'DELETE FROM sessions WHERE user_id=?',id)]:[]),audit(env,u,'user',id)]);
  return json({ok:true});
 }
 if(action==='product'){
  admin(u);
  const name=String(data.name||'').trim();if(!name||name.length>100)fail(400,'Nome inválido.');
  if(data.id){
   const p=await one(env,'SELECT * FROM products WHERE id=?',data.id);if(!p)fail(404,'Produto não encontrado.');
   await env.DB.batch([stmt(env,'UPDATE products SET name=?,active=? WHERE id=?',name,data.active===false?0:1,p.id),audit(env,u,'product',p.id)]);
   return json({ok:true});
  }
  const category=String(data.category||'').trim();if(!category||category.length>100)fail(400,'Escolha uma categoria válida.');
  if(await one(env,'SELECT id FROM products WHERE name=? COLLATE NOCASE AND category=? COLLATE NOCASE AND active=1',name,category))fail(409,'Este produto já existe nesta categoria.');
  const last=await one(env,'SELECT MAX(position) AS position FROM products WHERE category=?',category);
  const all=await one(env,'SELECT COALESCE(MAX(position),-1) AS position FROM products');
  const position=(last?.position??all.position)+1,id=crypto.randomUUID();
  await env.DB.batch([stmt(env,'UPDATE products SET position=position+1 WHERE position>=?',position),stmt(env,'INSERT INTO products(id,name,category,position,active) VALUES(?,?,?,?,1)',id,name,category,position),audit(env,u,'product',id)]);
  return json({ok:true,id});
 }
 if(action==='delete-product'){
  admin(u);const p=await one(env,'SELECT id FROM products WHERE id=?',data.id);if(!p)fail(404,'Produto não encontrado.');
  await env.DB.batch([stmt(env,'UPDATE products SET active=0 WHERE id=?',p.id),audit(env,u,'delete_product',p.id)]);
  return json({ok:true});
 }
 if(action==='bar'){
  admin(u);if(!Number.isInteger(data.bar)||data.bar<1||data.bar>6||typeof data.name!=='string'||!data.name.trim()||data.name.length>40)fail(400,'Nome de barra inválido.');
  await env.DB.batch([stmt(env,'UPDATE bars SET name=? WHERE id=?',data.name.trim(),data.bar),audit(env,u,'bar',data.bar)]);return json({ok:true});
 }
 fail(400,'Ação inválida.');
}
export default {async fetch(request,env){
 let response;
 try{if(new URL(request.url).pathname.startsWith('/api/'))response=await api(request,env);else response=await env.ASSETS.fetch(request)}
 catch(error){if(!(error instanceof HttpError))console.error('stock_request_failed',error.message);response=json({error:error instanceof HttpError?error.message:'Não foi possível salvar ou carregar. Tente novamente.'},error.status||503)}
 const headers=new Headers(response.headers);
 headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','same-origin');headers.set('X-Frame-Options','DENY');
 headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
 return new Response(response.body,{status:response.status,headers});
}};
