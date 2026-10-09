import test from 'node:test';
import assert from 'node:assert/strict';
const base=process.env.STOCK_TEST_URL;
test('fluxo real: autenticação, permissões, contagem, bloqueio, reabertura e histórico',{skip:!base},async()=>{
 const origin=new URL(base).origin;
 async function call(action,data={},cookie='',method='POST',withOrigin=true){const res=await fetch(base+'/api/stock'+(method==='GET'?'?'+new URLSearchParams({action,...data}):''),{method,headers:{...(method==='POST'?{'Content-Type':'application/json',...(withOrigin?{Origin:origin}:{})}:{}),...(cookie?{Cookie:cookie}:{})},body:method==='POST'?JSON.stringify({action,...data}):undefined});return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]}}
 assert.equal((await call('state',{},'','GET')).status,401);
 assert.equal((await call('login',{username:'testadmin',password:'wrong'})).status,401);
 assert.equal((await call('login',{username:'testadmin',password:'Test-Admin-Password-2026'},'','POST',false)).status,403);
 const login=await call('login',{username:'testadmin',password:'Test-Admin-Password-2026'});assert.equal(login.status,200);const admin=login.cookie;
 const initial=await call('state',{},admin,'GET');assert.equal(initial.status,200);assert.equal(initial.data.products.length,63);assert.deepEqual(initial.data.bars.map(b=>b.name),['Rose','Velha','Nova','Backstage','VIP','Depósito']);assert.equal(initial.data.closes.length,0);
 await call('user',{username:'rose.test',name:'Responsável Rose',password:'Rose-Test-Password-2026',role:'bar',bar:1,active:true},admin);
 await call('user',{username:'vip.test',name:'Responsável VIP',password:'VIP-Test-Password-2026',role:'bar',bar:5,active:true},admin);
 const rose=(await call('login',{username:'rose.test',password:'Rose-Test-Password-2026'})).cookie;
 const vip=(await call('login',{username:'vip.test',password:'VIP-Test-Password-2026'})).cookie;
 const state=await call('state',{},rose,'GET');assert.equal(state.status,200);assert.equal(state.data.bars.length,1);assert.equal(state.data.bars[0].name,'Rose');assert.equal(state.data.users,undefined);assert.equal(state.data.products,undefined);
 assert.equal((await call('shift',{date:'2026-10-06'},rose)).status,403);
 assert.equal((await call('shift',{date:'2026-02-30'},admin)).status,400);
 assert.equal((await call('shift',{date:'2026-10-06'},admin)).status,200);
 assert.equal((await call('start',{date:'2026-10-06',bar:5},rose)).status,403);
 const start=await call('start',{date:'2026-10-06',bar:1},rose);assert.equal(start.status,200);const c=start.data;assert.equal(c.products.length,63);assert.equal(c.entries.length,0);
 assert.equal((await call('close',{id:c.id},vip,'GET')).status,403);
 assert.equal((await call('quantity',{id:c.id,product:c.products[0].id,quantity:9},vip)).status,403);
 assert.equal((await call('quantity',{id:c.id,product:c.products[0].id,quantity:-1},rose)).status,400);
 assert.equal((await call('quantity',{id:c.id,product:'wrong-product',quantity:1},rose)).status,400);
 assert.equal((await call('submit',{id:c.id},rose)).status,409);
 for(const [i,p] of c.products.entries()){const r=await call('quantity',{id:c.id,product:p.id,quantity:i===0?0:i===1?0.5:i},rose);assert.equal(r.status,200)}
 assert.equal((await call('notes',{id:c.id,notes:'Teste de fechamento'},rose)).status,200);
 const saved=await call('close',{id:c.id},rose,'GET');assert.equal(saved.data.entries.length,63);assert.equal(saved.data.entries.find(e=>e.product===c.products[0].id).quantity,0);
 assert.equal((await call('submit',{id:c.id},rose)).status,200);
 assert.equal((await call('quantity',{id:c.id,product:c.products[0].id,quantity:12},rose)).status,409);
 assert.equal((await call('close_shift',{date:c.date},admin)).status,409);
 assert.equal((await call('reopen',{id:c.id},vip)).status,403);
 assert.equal((await call('reopen',{id:c.id},admin)).status,200);
 assert.equal((await call('quantity',{id:c.id,product:c.products[0].id,quantity:12},rose)).status,200);
 assert.equal((await call('submit',{id:c.id},rose)).status,200);
 const next=await call('start',{date:c.date,bar:1},rose);assert.equal(next.data.id,c.id);assert.equal(next.data.status,'submitted');
 for(let bar=2;bar<=6;bar++){const r=await call('start',{date:c.date,bar},admin);for(const p of r.data.products)assert.equal((await call('quantity',{id:r.data.id,product:p.id,quantity:0},admin)).status,200);assert.equal((await call('submit',{id:r.data.id},admin)).status,200)}
 assert.equal((await call('close_shift',{date:c.date},admin)).status,200);
 const report=await call('report',{date:c.date},admin,'GET');assert.equal(report.data.length,6);
 assert.equal((await call('report',{date:c.date},rose,'GET')).status,403);
 const hist=await call('state',{},rose,'GET');assert.equal(hist.data.closes.length,1);assert.equal(hist.data.closes[0].bar,1);
 await call('user',{id:initial.data.users[0].id,username:'testadmin',name:'Administrador',role:'bar',bar:1,active:true},admin).then(r=>assert.equal(r.status,400));
 assert.equal((await call('logout',{},rose)).status,200);assert.equal((await call('state',{},rose,'GET')).status,401);
});
