export const categories=['Aguas,jugo e refrigerantes','Energéticos','Vodka','Whisky','Gin','Licores','Espumantes','Cervejas'];
const groups=[
['Agua sem gas','Agua com gas','Agua de coco','Coca cola 2litros','Coca cola zero 2 litros','Coca cola lata','Coca cola zero lata','Guarana','Sprite','Schwepps citrus','Tónica','Suco de laranja'],
['Red Bull','Baly preto','Baly amarelo'],
['Absolut','Absolut Elyx','Ciroc/Grey Goose','Smirnoff','Raiska','Skyy'],
['Ballantines','Black label','Red label','Gold label','Chivas','Jack Daniels','Passport','White horse'],
['Beefeater','Bombay','Tanqueray','Rocks'],
['Aperol','Campari','Cynar','Fernet','Jagermeister','Licor 43','Licor de pessego','Licor de café','Martini Rosso','Pisco','Rum','Rum de coco','José Cuervo','Tequileiro','Triple sec','Velho Barreiro','Xarope de Gengibre','Espuma de gengibre'],
['Chandon','Mumm','Moet Chandon','Veuve Clicquot','Da Casa'],
['Skol Beats','Budweiser lata','Budweiser Zero','Budweiser long neck','Corona','Heineken','Stella']];
export const catalog=groups.flatMap((names,c)=>names.map((name,i)=>({id:`p${c+1}-${i+1}`,name,category:categories[c],position:c*100+i})));
export const barNames=['Rose','Velha','Nova','Backstage','VIP','Depósito'];
export function operationDate(){const d=new Date(Date.now()-3*3600000);if(d.getUTCHours()<12)d.setUTCDate(d.getUTCDate()-1);return d.toISOString().slice(0,10)}
