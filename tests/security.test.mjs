import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog,barNames} from '../src/catalog.js';
import {passwordHash,verifyPassword,validQuantity,validDate,canAccessBar} from '../src/security.js';
test('catálogo preserva 63 produtos, 8 categorias e as seis áreas',()=>{assert.equal(catalog.length,63);assert.equal(new Set(catalog.map(p=>p.category)).size,8);assert.deepEqual(barNames,['Rose','Velha','Nova','Backstage','VIP','Depósito']);assert.equal(catalog.filter(p=>p.name==='Ciroc/Grey Goose').length,1)});
test('hashes de senha usam sal individual e segredo do servidor',async()=>{const a=await passwordHash('Correct-Test-Password','test-pepper'),b=await passwordHash('Correct-Test-Password','test-pepper');assert.notEqual(a,b);assert.equal(await verifyPassword('Correct-Test-Password',a,'test-pepper'),true);assert.equal(await verifyPassword('Wrong-Test-Password',a,'test-pepper'),false);assert.equal(await verifyPassword('Correct-Test-Password',a,'different-pepper'),false)});
test('validação diferencia zero de vazio e rejeita quantidades inválidas',()=>{for(const n of [0,1,2.5,0.125,1000000])assert.equal(validQuantity(n),true);for(const n of ['',null,-1,NaN,Infinity,1.0001,1000001,'3'])assert.equal(validQuantity(n),false)});
test('datas inválidas não são normalizadas silenciosamente',()=>{assert.equal(validDate('2026-10-06'),true);assert.equal(validDate('2026-02-30'),false);assert.equal(validDate('06/10/2026'),false)});
test('encarregado acessa somente sua área',()=>{const rose={role:'bar',bar:1};for(let n=1;n<=6;n++)assert.equal(canAccessBar(rose,n),n===1);assert.equal(canAccessBar({role:'admin'},6),true)});
