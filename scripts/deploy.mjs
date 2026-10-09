import {spawn} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {createInterface} from 'node:readline/promises';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
const bin=resolve('node_modules/wrangler/bin/wrangler.js');
async function run(args,input){return new Promise((ok,bad)=>{const child=spawn(process.execPath,[bin,...args],{stdio:input===undefined?'inherit':['pipe','inherit','inherit']});if(input!==undefined)child.stdin.end(input);child.on('error',bad);child.on('exit',code=>code===0?ok():bad(new Error('A etapa falhou. Revise a mensagem acima antes de tentar novamente.')))})}
async function hidden(prompt){
 if(!process.stdin.isTTY)throw new Error('Execute a configuração em um terminal interativo.');
 process.stdout.write(prompt);process.stdin.setRawMode(true);process.stdin.resume();let value='';
 return new Promise((ok,bad)=>{const onData=chunk=>{for(const c of chunk.toString()){if(c==='\u0003'){done();bad(new Error('Configuração cancelada.'));return}if(c==='\r'||c==='\n'){done();ok(value);return}if(c==='\u007f'||c==='\b')value=value.slice(0,-1);else if(c>=' ')value+=c}};function done(){process.stdin.off('data',onData);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n')}process.stdin.on('data',onData)});
}
try{
 let config=JSON.parse(await readFile('wrangler.json','utf8'));
 console.log('JACKS LONDON · Configuração no Cloudflare\n');
 await run(['login']);
 const rl=createInterface({input:process.stdin,output:process.stdout});
 const username=(await rl.question('Usuário do administrador (mínimo 3 caracteres): ')).trim().toLowerCase();rl.close();
 if(!/^[a-z0-9._-]{3,40}$/.test(username))throw new Error('Usuário inválido. Use letras, números, ponto, hífen ou sublinhado.');
 const password=await hidden('Senha do administrador (mínimo 10 caracteres, não será exibida): ');
 const confirm=await hidden('Repita a senha: ');
 if(password.length<10||password.length>200||password!==confirm)throw new Error('As senhas devem coincidir e ter entre 10 e 200 caracteres.');
 if(config.d1_databases?.[0]?.database_id==='REPLACE_WITH_D1_DATABASE_ID'){
  const original=JSON.stringify(config,null,2);config.d1_databases=[];
  await writeFile('wrangler.json',JSON.stringify(config,null,2)+'\n');
  try{await run(['d1','create','jacks-london-estoque','--binding','DB','--update-config','true']);config=JSON.parse(await readFile('wrangler.json','utf8'));if(!config.d1_databases?.find(d=>d.binding==='DB'&&d.database_id))throw new Error('Não foi possível identificar o banco criado. Configure o ID em wrangler.json.');config.d1_databases.find(d=>d.binding==='DB').migrations_dir='migrations';await writeFile('wrangler.json',JSON.stringify(config,null,2)+'\n')}catch(e){if(!JSON.parse(await readFile('wrangler.json','utf8')).d1_databases?.length)await writeFile('wrangler.json',original+'\n');throw e}
 }
 await run(['d1','migrations','apply','DB','--remote']);
 // Secrets are transferred through stdin and are never stored in the project.
 // AUTH_PEPPER must remain stable across later deployments.
 const secrets={INITIAL_ADMIN_USER:username,INITIAL_ADMIN_PASSWORD:password};
 const rl2=createInterface({input:process.stdin,output:process.stdout});const first=(await rl2.question('Esta é a PRIMEIRA publicação, sem usuários cadastrados? Digite sim ou não: ')).trim().toLowerCase();rl2.close();
 if(first==='sim')secrets.AUTH_PEPPER=randomBytes(32).toString('hex');
 else if(first!=='não'&&first!=='nao')throw new Error('Confirme se esta é a primeira publicação antes de continuar.');
 await run(['secret','bulk'],JSON.stringify(secrets));
 await run(['deploy']);
 console.log('\nPlataforma publicada. Abra o endereço mostrado acima e entre com as credenciais escolhidas.\nEm Usuários, cadastre os seis responsáveis e atribua cada área.');
}catch(error){console.error(error.message);process.exitCode=1}
