'use strict';
(() => {
  // Candidate summaries are discussion leads, not confirmed interest or suitability.
  const people = [
    {id:'paul', name:'Paul de Lucena', title:'Technical Product & Architecture Leader | Former CTO',
      focus:'Technology leadership, systems design and decision science, including experience at Grubhub and in education technology.',
      why:'A conversation about product architecture and engineering execution as Ganaz explores more of the worker lifecycle.',
      tags:['Architecture','Systems Design','Technical Leadership'], group:'ganaz',
      profile:'https://www.linkedin.com/in/pdelucena'},
    {id:'spencer', name:'Spencer Sanchez', title:'Engineering Leader | Former Associate Director',
      focus:'Engineering leadership and web-platform experience.',
      why:'Potential engineering capacity for a portfolio team, pending confirmation of role requirements and hands-on expectations.',
      tags:['Web Platforms','Engineering Leadership'], group:'beacon',
      profile:'https://www.linkedin.com/in/spencersanchez/'},
    {id:'chip', name:'Chip Richards', title:'Enterprise Sales Professional',
      focus:'Enterprise sales and complex customer relationships.',
      why:'A possible introduction for portfolio commercial needs, depending on the specific role and customer segment.',
      tags:['Enterprise Sales','Business Development'], group:'beacon',
      profile:'https://www.linkedin.com/in/chip-richards/'}
  ];
  const cards = document.getElementById('cards'), message = document.getElementById('message');
  const copy = document.getElementById('copy'), clear = document.getElementById('clear');
  const feedback = document.getElementById('feedback');
  const selected = new Set();
  let filter = 'all';
  const el = (tag,cls,value) => {const node=document.createElement(tag);if(cls)node.className=cls;if(value!==undefined)node.textContent=value;return node;};
  function buildNote(){
    const picked = people.filter(p=>selected.has(p.id));
    if(!picked.length) return '';
    return 'Hey Paola!\n\nI pulled a few people who might be worth a conversation based on what you shared about Ganaz and the wider Beacon portfolio.\n\n' +
      picked.map(p=>p.name+' — '+p.title+'\n'+p.focus+'\nWhy I thought of them: '+p.why).join('\n\n') +
      '\n\nThese are conversation starters, not confirmed fits. If anyone interests you, I can check their interest before making an introduction.';
  }
  function updateNote(){
    message.value=buildNote();
    copy.disabled=!selected.size;
    feedback.textContent='';
  }
  function render(){
    cards.replaceChildren();
    const visible=people.filter(p=>filter==='all'||p.group===filter);
    for(const p of visible){
      const card=el('article','candidate'+(selected.has(p.id)?' selected':''));
      const head=el('header');
      const input=el('input');
      input.type='checkbox';input.checked=selected.has(p.id);
      input.setAttribute('aria-label','Select '+p.name);
      input.addEventListener('change',()=>{input.checked?selected.add(p.id):selected.delete(p.id);card.classList.toggle('selected',input.checked);updateNote();});
      const identity=el('div');
      identity.append(el('h2','',p.name),el('div','role',p.title));
      const link=el('a','', 'View LinkedIn');
      link.href=p.profile;link.target='_blank';link.rel='noopener noreferrer';identity.append(link);
      head.append(input,identity);card.append(head);
      const background=el('p');background.append(el('strong','','Background: '),document.createTextNode(p.focus));
      const fit=el('p','fit');fit.append(el('strong','','Why talk: '),document.createTextNode(p.why));card.append(background,fit);
      const tags=el('div');p.tags.forEach(t=>tags.append(el('span','tag',t)));card.append(tags);cards.append(card);
    }
    if(!visible.length)cards.append(el('p','empty','No people in this category yet.'));
  }
  document.querySelectorAll('[data-filter]').forEach(btn=>btn.addEventListener('click',()=>{
    filter=btn.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===btn)));
    render();
  }));
  clear.addEventListener('click',()=>{selected.clear();render();updateNote();});
  copy.addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText(message.value);feedback.textContent='Copied. You can paste and edit before sending.';}
    catch(e){message.focus();message.select();feedback.textContent='Copy unavailable. Select the text and copy manually.';}
  });
  render();updateNote();
})();