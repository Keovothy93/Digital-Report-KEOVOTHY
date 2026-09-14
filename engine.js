/* Pure data functions. Empty metrics remain null; reporting periods come from the export. */
(function(root){
const fields={id:['Post ID','Video ID','Content','Ad ID','Content ID'],title:['Title','Post message','Video title','Description','Post title','Ad name','Content title'],date:['Date','Day','Publish time','Video publish time','Reporting starts','Post time'],views:['Views','Video views','Post views','Video play actions','Total video views'],impressions:['Impressions','Total impressions'],reach:['Reach','Total reach','Post reach'],engagements:['Engagements','Post engagements','Content interactions','Interactions'],likes:['Likes','Reactions','Reactions, Comments and Shares - Reactions','Like count'],comments:['Comments','Comment count'],shares:['Shares','Share count'],clicks:['Link clicks','Clicks (destination)','Destination clicks','Clicks'],spend:['Amount spent (USD)','Spend','Cost','Total cost'],leads:['Leads','Messaging conversations started','New messaging contacts'],followers:['Net followers','Net subscribers','Subscribers','Followers gained','New followers'],watchHours:['Watch time (hours)','Watch hours'],starts:['Video starts','Video plays'],three:['3-second video views','3-second views'],complete:['Video views at 100%','Complete views','Video completions']};
const labels={id:'Post / Video ID',title:'ចំណងជើង Content',date:'ថ្ងៃ / Publish time',views:'Views',impressions:'Impressions',reach:'Reach',engagements:'Engagements',likes:'Likes / Reactions',comments:'Comments',shares:'Shares',clicks:'Clicks',spend:'Spend',leads:'Leads / Inbox',followers:'Followers / Subscribers',watchHours:'Watch time (hours)',starts:'Video starts',three:'3-second views',complete:'Complete views'};
const metrics=Object.keys(fields).filter(k=>!['id','title','date'].includes(k));
const normalize=s=>String(s??'').toLowerCase().replace(/\uFEFF/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
function suggest(headers){const map={};for(const [k,aliases] of Object.entries(fields)){const n=aliases.map(normalize);map[k]=headers.findIndex(h=>n.includes(normalize(h)));}return map;}
function parseNumber(v,locale='us'){
 if(v===null||v===undefined||v==='')return null;if(typeof v==='number')return Number.isFinite(v)?v:null;
 let s=String(v).trim();if(!s||/^(-+|—|n\/?a|null|not available)$/i.test(s))return null;
 s=s.replace(/[០-៩]/g,c=>String('០១២៣៤៥៦៧៨៩'.indexOf(c))).replace(/[\s\u00a0$៛€£¥]/g,'');
 const neg=/^\(.*\)$/.test(s);if(neg)s=s.slice(1,-1);
 if(locale==='eu')s=s.replace(/\./g,'').replace(',','.');else s=s.replace(/,/g,'');
 if(!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(s))return NaN;const n=Number(s);return neg?-n:n;
}
function parseCSV(text){text=text.replace(/^\uFEFF/,'');const first=text.split(/\r?\n/)[0];const delimiter=first.includes('\t')?'\t':(first.split(';').length>first.split(',').length?';':',');const rows=[];let row=[],cell='',q=false;for(let i=0;i<text.length;i++){let c=text[i];if(c==='"'){if(q&&text[i+1]==='"'){cell+='"';i++;}else q=!q;}else if(c===delimiter&&!q){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v!==''))rows.push(row);row=[];cell='';}else cell+=c;}if(q)throw Error('CSV មានសញ្ញាសម្រង់មិនពេញលេញ។');row.push(cell);if(row.some(v=>v!==''))rows.push(row);return rows;}
function normalizeRows(rows,map,opts){const out=[],errors=[],seen=new Set();let totals=0,duplicates=0,blanks=0;rows.forEach((row,i)=>{
 if(!row.some(v=>v!==''&&v!=null)){blanks++;return;}
 const r={};for(const key of ['id','title','date'])r[key]=map[key]>=0?String(row[map[key]]??'').trim():'';
 if(opts.grain!=='summary'&&[r.id,r.title,r.date,...row.slice(0,2)].some(v=>/^(total|totals|grand total|សរុប)$/i.test(String(v??'').trim()))){totals++;return;}
 let invalid=false;for(const key of metrics){const raw=map[key]>=0?row[map[key]]:null;const n=parseNumber(raw,opts.locale);if(Number.isNaN(n)||(n!=null&&n<0&&key!=='followers')){errors.push(`ជួរ ${i+opts.header+2}: ${labels[key]} «${raw}» មិនមែនជាលេខត្រឹមត្រូវ`);invalid=true;}r[key]=n;}
 if(invalid)return;
 if(r.engagements===null&&[r.likes,r.comments,r.shares].every(n=>n!==null)){r.engagements=r.likes+r.comments+r.shares;r.engagementBasis='likes + comments + shares';}
 if(!metrics.some(k=>r[k]!==null)){blanks++;return;}
 const fingerprint=JSON.stringify(r);if(seen.has(fingerprint)){duplicates++;return;}seen.add(fingerprint);r.sourceRow=i+opts.header+2;out.push(r);
 });return {rows:out,errors,totals,duplicates,blanks};}
function total(rows,key){const present=rows.filter(r=>Number.isFinite(r[key]));return {value:present.length?present.reduce((s,r)=>s+r[key],0):null,known:present.length,count:rows.length};}
function ratio(rows,a,b,mult=100){if(!rows.length||rows.some(r=>!Number.isFinite(r[a])||!Number.isFinite(r[b])))return null;const denominator=total(rows,b).value;return denominator>0?total(rows,a).value/denominator*mult:null;}
function aggregate(rows){const a={};metrics.forEach(k=>a[k]=total(rows,k));a.ctr=ratio(rows,'clicks','impressions');a.cpc=ratio(rows,'spend','clicks',1);a.cpm=ratio(rows,'spend','impressions',1000);a.cpl=ratio(rows,'spend','leads',1);a.er=ratio(rows,'engagements','impressions');a.hook=ratio(rows,'three','starts');a.completion=ratio(rows,'complete','starts');return a;}
function overlaps(a,b){return a.brand===b.brand&&a.platform===b.platform&&(a.kind===b.kind||a.kind==='Total'||b.kind==='Total')&&a.start<=b.end&&b.start<=a.end;}
function validDate(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T00:00:00Z');return !isNaN(d)&&d.toISOString().slice(0,10)===v;}
const api={fields,labels,metrics,normalize,suggest,parseNumber,parseCSV,normalizeRows,total,ratio,aggregate,overlaps,validDate};root.Perf=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
