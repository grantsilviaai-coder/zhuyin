import sys,re
url=sys.argv[1]; outp=sys.argv[2]
old=open('zhuyin.html',encoding='utf-8').read()
head=old[:old.index('</style>')].replace('<title>注音小學堂</title>','<title>注音診斷站</title>')
extra=open('build/extra.css',encoding='utf-8').read()
dcss="""
/* 診斷站：用不同的主色，跟注音小學堂分得出來 */
:root{--accent:#0f766e;--accent-soft:#d9f0ec}
.phase-tag{display:inline-block;background:var(--accent);color:#fff;font-weight:700;border-radius:8px;padding:2px 12px;font-size:16px}
.rules{margin:0;padding-left:22px;display:grid;gap:6px;font-size:18px}
.opt.picked{background:var(--accent-soft);border-color:var(--accent);box-shadow:3px 3px 0 var(--accent)}
"""
body=open('build/diag_body.html',encoding='utf-8').read()
raw=open('build/raw.txt',encoding='utf-8').read()
core=open('build/app.js',encoding='utf-8').read(); core=core[:core.index('function buildRound')].replace('__SCRIPT_URL__',url)
app=open('build/app.js',encoding='utf-8').read()
a=app.index('// 直式注音：符號由上往下排'); b=app.index('let round=[]')
view=app[a:b]
svg=re.search(r"const speakerSVG = .*?;\n",app).group(0)
diag=open('build/diag.js',encoding='utf-8').read()
out=head+extra+dcss+'</style>\n</head>\n'+body+'\n<script>\n'+raw+'\n\n'+core+'\n'+view+'\n'+svg+diag+'</script>\n</body>\n</html>\n'
open(outp,'w',encoding='utf-8').write(out)
