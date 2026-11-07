(function(){
const current=['Demokratische_Republik_Kongo','Ruanda','Burundi','Uganda','Tasania','Republik_Kongo','Angola','Zentralafrikanische_Republik','Sambia'];
const planned=['Benin','Burkina_Faso','Kamerun','Tschad','Elfenbeinkueste','Dschibuti','Gabun','Guinea','Aequatorialguinea','Madagaskar','Mali','Mauretanien','Marokko','Niger','Senegal','Togo','Tunesien','Algerien'];
const host=document.getElementById('africa-map');if(!host)return;
fetch('/assets/carte-afrique-actuscout.svg').then(r=>{if(!r.ok)throw new Error('Carte indisponible');return r.text()}).then(raw=>{
const doc=new DOMParser().parseFromString(raw,'image/svg+xml');if(doc.querySelector('parsererror'))throw new Error('SVG invalide');
const svg=doc.documentElement;svg.removeAttribute('width');svg.removeAttribute('height');svg.setAttribute('preserveAspectRatio','xMidYMid meet');
const paint=(id,color)=>{const el=doc.getElementById(id);if(!el)return;const shapes=[el,...el.querySelectorAll('path,polygon,polyline')];shapes.forEach(shape=>{if(shape.matches('path,polygon,polyline')){shape.style.fill=color;shape.style.stroke='#fff';shape.style.strokeWidth='1.15';shape.style.vectorEffect='non-scaling-stroke'}})};
planned.forEach(id=>paint(id,'#9675c7'));current.forEach(id=>paint(id,'#e0b34e'));
host.replaceChildren(document.importNode(svg,true));
}).catch(()=>{host.innerHTML='<p class="map-loading">La carte sera affichée dès que le fichier SVG sera ajouté aux ressources du site.</p>'});
})();