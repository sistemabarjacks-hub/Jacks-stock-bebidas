const enc=new TextEncoder();
export function token(){const a=crypto.getRandomValues(new Uint8Array(32));return Array.from(a,x=>x.toString(16).padStart(2,'0')).join('')}
export async function digest(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(value))),x=>x.toString(16).padStart(2,'0')).join('')}
export function equal(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0}
export async function passwordHash(password,pepper,salt=token().slice(0,32)){
 const material=await crypto.subtle.importKey('raw',enc.encode(password+'\0'+pepper),'PBKDF2',false,['deriveBits']);
 const value=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:enc.encode(salt),iterations:100000},material,256);
 const hash=Array.from(new Uint8Array(value),x=>x.toString(16).padStart(2,'0')).join('');
 return 'pbkdf2-sha256$100000$'+salt+'$'+hash;
}
export async function verifyPassword(password,stored,pepper){const parts=stored.split('$');if(parts.length!==4||parts[0]!=='pbkdf2-sha256'||parts[1]!=='100000')return false;return equal(await passwordHash(password,pepper,parts[2]),stored)}
export function validQuantity(value){return typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1000000&&Math.abs(value*1000-Math.round(value*1000))<0.00001}
export function validDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+'T12:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===value}
export function canAccessBar(user,bar){return user.role==='admin'||(user.role==='bar'&&user.bar===bar)}
