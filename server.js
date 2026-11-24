const http=require('http'),fs=require('fs'),path=require('path');
const {WebSocketServer}=require('ws');
const W=40,H=40,TICK=120,FOODS=20;
const DX=[0,1,0,-1],DY=[-1,0,1,0];
const COLORS=['#ffd23f','#3bceac','#ee4266','#5dade2','#f78c6b','#b388eb','#9ef01a','#ff9f1c'];
const players=new Map();let food=[],nid=1;
const rnd=n=>Math.floor(Math.random()*n);
const occupied=(x,y)=>[...players.values()].some(p=>p.alive&&p.body.some(s=>s.x===x&&s.y===y))||food.some(f=>f.x===x&&f.y===y);
function spawnFood(){while(food.length<FOODS){const x=rnd(W),y=rnd(H);if(!occupied(x,y))food.push({x,y});}}
function spawn(p){
  for(let i=0;i<200;i++){const x=4+rnd(W-8),y=4+rnd(H-8);
    if([0,1,2].every(k=>!occupied(x-k,y))){p.body=[{x,y},{x:x-1,y},{x:x-2,y}];p.dir=1;p.next=1;p.alive=true;p.score=0;return;}}
}
const server=http.createServer((req,res)=>{
  const f=path.join(__dirname,'public',req.url==='/'?'index.html':path.normalize(req.url).replace(/^(\.\.[\/\\])+/,''));
  fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);return res.end('404');}
    res.writeHead(200,{'Content-Type':f.endsWith('.html')?'text/html; charset=utf-8':'text/plain'});res.end(d);});
});
const wss=new WebSocketServer({server});
wss.on('connection',ws=>{
  const p={id:nid++,name:'Cobra',color:COLORS[nid%COLORS.length],body:[],dir:1,next:1,alive:false,score:0,ws};
  players.set(p.id,p);ws.send(JSON.stringify({t:'init',id:p.id,w:W,h:H}));
  ws.on('message',m=>{let d;try{d=JSON.parse(m);}catch{return;}
    if(d.t==='join'){p.name=String(d.name||'Cobra').slice(0,12);if(!p.alive)spawn(p);}
    else if(d.t==='dir'&&Number.isInteger(d.d)&&d.d>=0&&d.d<4&&(d.d+2)%4!==p.dir)p.next=d.d;});
  ws.on('close',()=>players.delete(p.id));
});
setInterval(()=>{
  const alive=[...players.values()].filter(p=>p.alive);
  const heads=new Map();
  for(const p of alive){p.dir=p.next;const h=p.body[0];heads.set(p.id,{x:h.x+DX[p.dir],y:h.y+DY[p.dir]});}
  const dead=new Set();
  for(const p of alive){
    const h=heads.get(p.id);
    if(h.x<0||h.y<0||h.x>=W||h.y>=H){dead.add(p.id);continue;}
    for(const q of alive){
      if(q.body.slice(0,-1).some(s=>s.x===h.x&&s.y===h.y)){dead.add(p.id);break;}
      if(q!==p){const qh=heads.get(q.id);if(qh.x===h.x&&qh.y===h.y){dead.add(p.id);break;}}
    }
  }
  for(const p of alive){
    if(dead.has(p.id)){
      for(const s of p.body)if(Math.random()<.5&&food.length<80)food.push({x:s.x,y:s.y});
      p.alive=false;p.ws.send(JSON.stringify({t:'dead',score:p.score}));continue;
    }
    const h=heads.get(p.id);p.body.unshift(h);
    const i=food.findIndex(f=>f.x===h.x&&f.y===h.y);
    if(i>=0){food.splice(i,1);p.score++;}else p.body.pop();
  }
  spawnFood();
  const live=[...players.values()].filter(p=>p.alive);
  const msg=JSON.stringify({t:'s',
    sn:live.map(p=>({id:p.id,n:p.name,c:p.color,b:p.body.flatMap(s=>[s.x,s.y])})),
    f:food.flatMap(f=>[f.x,f.y]),
    lb:live.sort((a,b)=>b.score-a.score).slice(0,5).map(p=>[p.name,p.score]),
    on:players.size});
  for(const p of players.values())if(p.ws.readyState===1){
    const own=p.alive?p.score:undefined;p.ws.send(msg.slice(0,-1)+',"sc":'+(own??'null')+'}');}
},TICK);
server.listen(process.env.PORT||3000,()=>console.log('Cobra Online rodando'));
