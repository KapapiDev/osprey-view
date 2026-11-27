'use strict';
const $ = id => document.getElementById(id);
const local = ['127.0.0.1','localhost'].includes(location.hostname);
const dataRoot = local ? './' : 'https://raw.githubusercontent.com/KapapiDev/osprey-view/data/';
const pixel = 'Departure, Galmuri, monospace';
const ink = '#e6e6de', bg = '#101212';
const dateFormat = new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
const stamp = seconds => dateFormat.format(seconds*1000);
const dayOf = seconds => stamp(seconds).slice(0,10);
const cash = value => Number(value).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:4,signDisplay:'exceptZero'});
const price = value => Number(value).toLocaleString('en-US',{maximumFractionDigits:10});
let report,day='',raw=[],tf=15,selected=null,tab='day',limit=30,requestId=0;
let plotted=[],hit=[],layout=null;
const archives=new Map();
function label(node,value){$(node).textContent=value;}
function showWarning(message){label('warning',message);$('warning').hidden=!message;}
async function read(file){
 const url=new URL(dataRoot+file,location.href);
 if(!local)url.searchParams.set('v',Math.floor(Date.now()/300000));
 const response=await fetch(url,{cache:'no-store',credentials:'omit'});
 if(!response.ok)throw Error('data unavailable');
 return response.json();
}
function fillText(f){return stamp(f.time)+' KST · '+f.side+' '+(f.side==='B'?'매수':'매도')+' @ '+f.price+' USDT · '+f.qty+'계약';}
function roundBars(rows){
 const bars=[];
 for(const [t,o,h,l,c] of rows){
  const start=Math.floor(t/(tf*60))*tf*60;
  const last=bars[bars.length-1];
  if(last&&last.t===start){last.h=Math.max(h,last.h);last.l=Math.min(l,last.l);last.c=c;}
  else bars.push({t:start,o,h,l,c});
 }
 return bars;
}
function draw(){
 const canvas=$('market'),w=canvas.clientWidth,h=canvas.clientHeight;
 if(!w||!h)return;
 const ratio=Math.min(window.devicePixelRatio||1,3);
 canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);
 const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);ctx.clearRect(0,0,w,h);
 plotted=roundBars(raw);hit=[];layout=null;$('noBars').hidden=!!plotted.length;
 if(!plotted.length){label('quote','—');label('quoteTime','');label('barRead','선택한 날짜의 시세 없음');$('detail').hidden=true;return;}
 const end=plotted.at(-1);label('quote',price(end.c)+' USDT');label('quoteTime',stamp(raw.at(-1)[0]).slice(5,16)+' KST · 최근 봉');
 const chartFills=report.fills.filter(f=>dayOf(f.time)===day);
 const points=chartFills.map(f=>Number(f.price));
 const min=Math.min(...plotted.map(b=>b.l),...points),max=Math.max(...plotted.map(b=>b.h),...points);
 const pad=Math.max((max-min)*0.10,max*0.00012),lo=min-pad,hi=max+pad;
 const left=6,right=w-(w<450?61:76),top=16,bottom=h-26;
 const start=plotted[0].t,finish=end.t+tf*60;
 const step=(right-left)*tf*60/(finish-start);
 const x=t=>left+(t-start)/(finish-start)*(right-left);
 const y=p=>bottom-(p-lo)/(hi-lo)*(bottom-top);
 layout={x,y,left,right,start,finish};
 ctx.font='10px '+pixel;
 for(let i=0;i<=4;i++){
  const p=lo+(hi-lo)*i/4,py=y(p);
  ctx.strokeStyle='#333735';ctx.setLineDash([2,4]);ctx.beginPath();ctx.moveTo(left,py);ctx.lineTo(right,py);ctx.stroke();
  ctx.fillStyle='#a9ada5';ctx.fillText(price(Math.round(p)),right+5,py+3);
 }
 ctx.setLineDash([]);
 for(const b of plotted){
  const xx=x(b.t)+step/2,up=b.c>=b.o,bw=Math.max(1,step*.56);
  ctx.strokeStyle=up?ink:'#92978e';ctx.fillStyle=up?ink:bg;
  ctx.beginPath();ctx.moveTo(xx,y(b.h));ctx.lineTo(xx,y(b.l));ctx.stroke();
  const yy=Math.min(y(b.o),y(b.c)),height=Math.max(1,Math.abs(y(b.o)-y(b.c)));
  ctx.fillRect(xx-bw/2,yy,bw,height);if(!up)ctx.strokeRect(xx-bw/2,yy,bw,height);
 }
 ctx.fillStyle='#a9ada5';const divisions=w<450?3:5;
 for(let i=0;i<divisions;i++){const b=plotted[Math.floor((plotted.length-1)*i/(divisions-1))];
  const tx=Math.min(right-30,Math.max(left,x(b.t)));ctx.fillText(stamp(b.t).slice(11,16),tx,h-6);}
 const lanes=new Map();
 for(const f of [...chartFills].reverse()){
  const xx=x(f.time),yy=y(Number(f.price));if(xx<left||xx>right)continue;
  const side=f.side, key=Math.floor(xx/20)+'/'+side;
  const lane=lanes.get(key)||0;lanes.set(key,lane+1);
  const badgeX=Math.max(left+8,Math.min(right-8,xx+(lane%3-1)*(lane?9:0)));
  const badgeY=Math.max(10,Math.min(bottom-8,yy+(side==='B'?1:-1)*(16+(lane%3)*12)));
  ctx.strokeStyle=ink;ctx.fillStyle=ink;ctx.beginPath();ctx.moveTo(xx,yy);ctx.lineTo(badgeX,badgeY);ctx.stroke();
  ctx.fillRect(xx-2,yy-2,4,4);ctx.fillStyle=side==='B'?ink:bg;ctx.fillRect(badgeX-8,badgeY-8,16,16);
  ctx.strokeRect(badgeX-8,badgeY-8,16,16);ctx.fillStyle=side==='B'?bg:ink;ctx.textAlign='center';ctx.fillText(side,badgeX,badgeY+4);ctx.textAlign='left';
  hit.push({x:badgeX,y:badgeY,f});
 }
 const focus=selected===null?null:plotted.find(b=>selected>=b.t&&selected<b.t+tf*60);
 if(focus){
  const xx=x(focus.t)+step/2;ctx.setLineDash([2,3]);ctx.strokeStyle=ink;ctx.beginPath();ctx.moveTo(xx,top);ctx.lineTo(xx,bottom);ctx.stroke();
  label('barRead',stamp(focus.t).slice(11,16)+' · O '+price(focus.o)+' H '+price(focus.h)+' L '+price(focus.l)+' C '+price(focus.c));
  const same=chartFills.filter(f=>f.time>=focus.t&&f.time<focus.t+tf*60);
  label('detail',same.map(fillText).join('\n'));$('detail').hidden=!same.length;
 }else{
  label('barRead',chartFills.length?'마커를 누르면 체결 상세가 열립니다.':'선택한 날짜의 체결 0건');
  $('detail').hidden=true;
 }
}
async function loadDay(next,focus=null){
 const id=++requestId;day=next;selected=focus;$('chartDay').value=day;
 try{
  let rows;
  if(next===report.today)rows=report.candles;
  else if(archives.has(next))rows=archives.get(next);
  else{rows=await read('candles/'+next+'.json');if(rows.length)archives.set(next,rows);}
  if(id===requestId){raw=rows;draw();}
 }catch{if(id===requestId){raw=[];draw();}}
}
function makeTable(){
 const daily=tab==='day',month=$('month').value;
 $('dayTab').setAttribute('aria-pressed',daily);$('fillTab').setAttribute('aria-pressed',!daily);
 const rows=(daily?[...report.days].reverse():report.fills).filter(r=>(daily?r.day:dayOf(r.time)).startsWith(month));
 const box=$('table');box.replaceChildren();$('more').hidden=rows.length<=limit;
 if(!rows.length){const e=document.createElement('p');e.className='empty';e.textContent='해당 기간의 '+(daily?'정산 기록':'실거래 체결')+'이 없습니다.';box.append(e);return;}
 const table=document.createElement('table'),head=table.createTHead().insertRow();
 for(const s of daily?['날짜 · KST','체결','종료 거래','실현손익','누적손익']:['체결 시각 · KST','매매','체결가 · USDT','계약 수']){const th=document.createElement('th');th.textContent=s;head.append(th);}
 for(const r of rows.slice(0,limit)){
  const tr=table.insertRow();
  const values=daily?[r.day,r.entries+r.exits,r.closed,cash(r.pnl),cash(r.cumulative)]:[stamp(r.time),r.side+' '+(r.side==='B'?'매수':'매도'),r.price,r.qty];
  values.forEach((v,i)=>{const td=tr.insertCell();if(i!==0){td.textContent=v;return;}
   const jump=document.createElement('button');jump.className='jump';jump.textContent=v;jump.title='이 날짜의 차트 보기';
   jump.onclick=()=>{loadDay(daily?r.day:dayOf(r.time),daily?null:r.time);document.querySelector('.chart-window').scrollIntoView({block:'start'});};td.append(jump);});
 }
 box.append(table);
}
function render(){
 const today=report.days.find(r=>r.day===report.today),last=report.fills[0];
 label('total',cash(report.total));label('today',cash(today.pnl));label('fills',report.fills.length);
 label('last',last?last.side+' @ '+last.price:'첫 체결 대기');label('last-time',last?stamp(last.time)+' KST':'');
 label('updated',stamp(report.updated)+' KST 갱신');
 const notes=[];if(Date.now()/1000-report.updated>1100)notes.push('갱신 지연 · 마지막으로 확인한 기록입니다.');
 if(report.pending)notes.push('손익 정산 대기 '+report.pending+'건');if(report.syncing)notes.push('일부 체결 상세를 Gate 원장과 대조 중입니다.');
 showWarning(notes.join(' / '));
 const month=$('month'),prev=month.value,months=new Set(report.days.map(d=>d.day.slice(0,7)));
 month.replaceChildren(new Option('전체 기간',''));[...months].sort().reverse().forEach(v=>month.add(new Option(v,v)));month.value=months.has(prev)?prev:'';
 $('chartDay').min=report.first;$('chartDay').max=report.today;makeTable();
}
async function refresh(){
 try{const previous=report?.today;report=await read('snapshot.json');render();
  await loadDay(!day||day===previous?report.today:day,selected);
 }catch{showWarning('최신 데이터를 불러올 수 없습니다. 잠시 후 다시 조회합니다.');}
}
$('market').onclick=event=>{
 if(!layout)return;const rect=event.currentTarget.getBoundingClientRect(),xx=event.clientX-rect.left,yy=event.clientY-rect.top;
 const targets=hit.filter(m=>Math.abs(m.x-xx)<14&&Math.abs(m.y-yy)<14).sort((a,b)=>Math.hypot(a.x-xx,a.y-yy)-Math.hypot(b.x-xx,b.y-yy));
 const candidate=targets[0]?.f.time??layout.start+(xx-layout.left)/(layout.right-layout.left)*(layout.finish-layout.start);
 selected=Math.max(layout.start,Math.min(layout.finish-1,candidate));draw();
};
$('market').onkeydown=e=>{if(!layout||!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();
 selected=Math.max(layout.start,Math.min(layout.finish-1,(selected??layout.finish-1)+(e.key==='ArrowRight'?1:-1)*tf*60));draw();};
for(const b of document.querySelectorAll('[data-tf]'))b.onclick=()=>{tf=Number(b.dataset.tf);document.querySelectorAll('[data-tf]').forEach(x=>x.setAttribute('aria-pressed',x===b));draw();};
$('chartDay').onchange=e=>{if(e.target.value&&e.target.validity.valid)loadDay(e.target.value);};
$('dayTab').onclick=()=>{if(report){tab='day';limit=30;makeTable();}};$('fillTab').onclick=()=>{if(report){tab='fill';limit=30;makeTable();}};
$('month').onchange=()=>{limit=30;makeTable();};$('more').onclick=()=>{limit+=30;makeTable();};
window.addEventListener('resize',()=>{if(report)draw();});
document.fonts.ready.then(()=>{if(report)draw();});refresh();setInterval(refresh,local?15000:60000);
