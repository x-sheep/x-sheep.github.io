/*! @license pzpr.js v (c) 2009-2020 sabo2, MIT license
 *   https://github.com/sabo2/pzprv3 */

!function(){function a(a){return d.getElementById(a)}function b(a,b){var c="";if(void 0!==a.dataset)c=a.dataset[b];else{for(var d="data-",e=0;e<b.length;e++){var f=b[e]||b.charAt(e);d+=f>="A"&&f<="Z"?"-"+f.toLowerCase():f}c=a[d]||a.getAttribute(d)||""}return c}var c={doclang:pzpr.lang,complete:!1,testdoc:!1,captions:[],phtml:"p.html",extend:function(a){for(var b in a)this[b]=a[b]}},d=document,e=c;e.doclang=JSON.parse(localStorage["pzprv3_config:ui"]||"{}").language||pzpr.lang,"?en"!==location.search&&"?ja"!==location.search||(e.doclang=location.search.substr(1,2)),"puzz.link"===location.hostname&&(e.phtml="p"),c.extend({onload_func:function(){Array.prototype.slice.call(d.querySelectorAll("#puztypes > li")).forEach(function(a){if(a.id.match(/puzmenu_(.+)$/)){var b=RegExp.$1;a.addEventListener("click",function(a){return function(b){e.click_tab(a)}}(b),!1)}}),a("puztypes")&&(a("puztypes").style.display="block"),e.disp_tab(),e.setTranslation(),e.translate()},click_tab:function(a){Array.prototype.slice.call(d.querySelectorAll("#puztypes > li")).forEach(function(b){b.className=b.id==="puzmenu_"+a?"puzmenusel":"puzmenu"}),e.disp_tab(),"all"===b(d.querySelector("li.puzmenusel"),"table")&&e.set_puzzle_filter(a),"input"===a&&e.dbif.display()},disp_tab:function(){var a={};Array.prototype.slice.call(d.querySelectorAll("#puztypes > li")).forEach(function(c){if(c.id.match(/puzmenu_(.+)$/)){var d="table_"+b(c,"table");void 0===a[d]&&(a[d]=!1),!1===a[d]&&"puzmenusel"===c.className&&(a[d]=!0)}}),Array.prototype.slice.call(d.querySelectorAll("div.puztable")).forEach(function(b){b.style.display=a[b.id||"1"]?"block":"none"})},set_puzzle_filter:function(a){Array.prototype.slice.call(d.querySelectorAll(".lists ul > li")).forEach(function(c){var d=pzpr.variety.toPID(b(c,"pid"));if(d){var f="all"===a||a===(e.variety[d]?e.variety[d].tab:"extra");c.style.display=f?"":"none"}}),Array.prototype.slice.call(d.querySelectorAll(".lists ul")).forEach(function(a){var b=0;Array.prototype.slice.call(a.querySelectorAll("li")).forEach(function(a){"none"!==a.style.display&&b++}),a.parentNode.style.display=b>0?"":"none"})},setlang:function(a){e.doclang=a,e.translate();var b=JSON.parse(localStorage["pzprv3_config:ui"]||"{}");b.language=a,localStorage["pzprv3_config:ui"]=JSON.stringify(b)},setTranslation:function(){Array.prototype.slice.call(d.querySelectorAll(".lists li")).forEach(function(a){var d=pzpr.variety(b(a,"pid")),f=d.pid;d.valid&&(0===a.childNodes.length&&(a.className=e.variety[f]?e.variety[f].state:"omopa",a.innerHTML='<a href="'+c.phtml+"?"+f+(e.testdoc?"_test":"")+'"></a>'),e.captions.push({anode:a.firstChild,str_jp:d.ja,str_en:d.en}))})},translate:function(){for(var a=0;a<this.captions.length;a++){var b=this.captions[a];if(b.anode){var c="ja"===e.doclang?b.str_jp:b.str_en;b.anode.innerHTML=c.replace(/(\(.+\))/g,"<small>$1</small>")}}Array.prototype.slice.call(d.body.querySelectorAll('[lang="ja"]')).forEach(function(a){a.style.display="ja"===e.doclang?"":"none"}),Array.prototype.slice.call(d.body.querySelectorAll('[lang="en"]')).forEach(function(a){a.style.display="en"===e.doclang?"":"none"})}}),window.addEventListener("load",e.onload_func,!1),window.v3index=c}(),function(){var a=window.v3index,b={lunch:["nurikabe","tilepaint","norinori","nurimaze","heyawake","hitori","slither","mashu","yajilin","slalom","numlin","hashikake","herugolf","shikaku","tentaisho","kakuro","sudoku","fillomino","ripple","akari","shakashaka"],testa:["nagare","dosufuwa","usoone","moonsun"],trial:["stostone","armyants"],lunch2:["box","lits","kurodoko","goishi"],lunch3:["minarism","factors"],nigun:["creek","mochikoro","tasquare","kurotto","shimaguni","yajikazu","cave","country","reflect","icebarn","firefly","kaero","yosenabe","bdblock","fivecells","sashigane","tatamibari","sukoro","gokigen","tateyoko","kinkonkan","hebi","makaro","juosan"],omopa:["nuribou","tawa","lookair","paintarea","chocona","kurochute","mejilink","pipelink","loopsp","nagenawa","kouchoku","ringring","pipelinkr","barns","icelom","icelom2","wblink","kusabi","ichimaga","ichimagam","ichimagax","amibo","bonsan","heyabon","rectslider","nawabari","triplace","fourcells","kramma","kramman","shwolf","loute","fillmat","usotatami","yajitatami","kakuru","view","bosanowa","nanro","cojun","renban","sukororoom","hanare","kazunori","wagiri","shugaku","hakoiri","roma","toichika","cbblock","nondango","onsen"],orig:["mochinyoro","ayeheya","aho"],genre:["tapa","arukone","yinyang","skyscrapers","kropki","starbattle","easyasabc","walllogic"],add:["angleloop","doubleback","nurimisaki","meander","satogaeri","scrin","heteromino","yajilin-regions","dbchoco","geradeweg","pencils","curvedata","aquarium","compass","castle","araf","maxi","midloop"]},c={lunch:"lunch",lunch2:"lunch",lunch3:"nigun",testa:"nigun",nigun:"nigun",trial:"omopa",omopa:"omopa",orig:"extra",genre:"extra",add:"add"},d={};for(var e in b)b[e].forEach(function(a){d[pzpr.variety.toPID(a)]={state:e,tab:c[e]}});a.extend({variety:d})}();
//# sourceMappingURL=v3index.js.map